import { Router } from "express";
import { requireAuth, requireMfaIfEnrolled } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { canManageOrgSettings, getMembership } from "../lib/organizations";
import {
    canPurchaseTokens,
    ENTERPRISE_SEAT_PRICE_USD,
    INCLUDED_TOKENS,
    PERSONAL_PRICE_USD,
    TOKEN_PACK_PRICE_USD,
    TOKEN_PACK_TOKENS,
} from "../lib/billing/quotas";
import {
    countOrgOccupiedSeats,
    ensureOrgWallet,
    ensureUserWallet,
    listLedger,
    resolveWallet,
    serializeWallet,
} from "../lib/billing/wallet";
import {
    createBillingPortal,
    createPackCheckout,
    createSubscriptionCheckout,
    isStripeConfigured,
    updateSubscriptionSeats,
} from "../lib/billing/stripe";
import { BillingNotConfiguredError } from "../lib/billing/errors";

export const billingRouter = Router();

function errorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

async function walletForRequest(
    req: { query: Record<string, unknown>; body?: Record<string, unknown> },
    userId: string,
) {
    const db = createServerSupabase();
    const organizationId =
        (typeof req.query.organizationId === "string" &&
            req.query.organizationId) ||
        (typeof req.body?.organizationId === "string" &&
            req.body.organizationId) ||
        null;
    if (organizationId) {
        const membership = await getMembership(db, organizationId, userId);
        if (!membership) {
            const err = new Error("Organization not found");
            (err as { status?: number }).status = 404;
            throw err;
        }
        const wallet = await ensureOrgWallet(db, organizationId);
        return { db, wallet, membership, organizationId };
    }
    const wallet = await ensureUserWallet(db, userId);
    return { db, wallet, membership: null, organizationId: null };
}

billingRouter.get("/catalog", (_req, res) => {
    res.json({
        currency: "usd",
        personalPriceUsd: PERSONAL_PRICE_USD,
        enterpriseSeatPriceUsd: ENTERPRISE_SEAT_PRICE_USD,
        tokenPackPriceUsd: TOKEN_PACK_PRICE_USD,
        tokenPackTokens: TOKEN_PACK_TOKENS,
        includedTokens: INCLUDED_TOKENS,
        stripeConfigured: isStripeConfigured(),
    });
});

billingRouter.get("/summary", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    try {
        const { db, wallet } = await walletForRequest(req, userId);
        const ledger = await listLedger(db, wallet.id, 40);
        res.json({
            wallet: serializeWallet(wallet, isStripeConfigured()),
            ledger,
        });
    } catch (error) {
        const status = (error as { status?: number }).status ?? 500;
        res.status(status).json({ detail: errorMessage(error) });
    }
});

billingRouter.post(
    "/checkout/subscription",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        const userId = res.locals.userId as string;
        const email = res.locals.userEmail as string;
        const plan = req.body?.plan === "enterprise" ? "enterprise" : "personal";
        const seats = Math.max(1, Number(req.body?.seats) || 1);
        const organizationId =
            typeof req.body?.organizationId === "string"
                ? req.body.organizationId
                : null;
        try {
            if (plan === "enterprise") {
                if (!organizationId) {
                    return void res.status(400).json({
                        detail: "Create an organization before starting Enterprise billing.",
                    });
                }
                const db = createServerSupabase();
                const membership = await getMembership(db, organizationId, userId);
                if (!membership || !canManageOrgSettings(membership.role)) {
                    return void res.status(403).json({ detail: "Forbidden" });
                }
                const occupied = await countOrgOccupiedSeats(db, organizationId);
                const wallet = await ensureOrgWallet(db, organizationId);
                const url = await createSubscriptionCheckout({
                    db,
                    wallet,
                    email,
                    plan,
                    seats: Math.max(seats, occupied, 1),
                    userId,
                    organizationId,
                });
                return void res.json({ url });
            }
            const db = createServerSupabase();
            const wallet = await ensureUserWallet(db, userId);
            const url = await createSubscriptionCheckout({
                db,
                wallet,
                email,
                plan: "personal",
                seats: 1,
                userId,
            });
            res.json({ url });
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                return void res.status(503).json({
                    code: error.code,
                    detail: error.message,
                });
            }
            res.status(500).json({ detail: errorMessage(error) });
        }
    },
);

billingRouter.post(
    "/checkout/pack",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        const userId = res.locals.userId as string;
        const email = res.locals.userEmail as string;
        const packs = Math.max(1, Number(req.body?.packs) || 1);
        try {
            const { db, wallet } = await walletForRequest(req, userId);
            if (!canPurchaseTokens(wallet.plan)) {
                return void res.status(400).json({
                    detail: "Token packs are available on Personal and Enterprise plans.",
                });
            }
            const url = await createPackCheckout({
                db,
                wallet,
                email,
                packs,
                userId,
            });
            res.json({ url });
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                return void res.status(503).json({
                    code: error.code,
                    detail: error.message,
                });
            }
            res.status(500).json({ detail: errorMessage(error) });
        }
    },
);

billingRouter.post(
    "/portal",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        const userId = res.locals.userId as string;
        try {
            const { wallet } = await walletForRequest(req, userId);
            if (!wallet.stripe_customer_id) {
                return void res.status(400).json({
                    detail: "No billing customer is on file yet.",
                });
            }
            const url = await createBillingPortal(wallet.stripe_customer_id);
            res.json({ url });
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                return void res.status(503).json({
                    code: error.code,
                    detail: error.message,
                });
            }
            res.status(500).json({ detail: errorMessage(error) });
        }
    },
);

billingRouter.post(
    "/auto-recharge",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        const userId = res.locals.userId as string;
        const enabled = req.body?.enabled === true;
        const packs = Math.max(1, Math.min(10, Number(req.body?.packs) || 1));
        try {
            const { db, wallet } = await walletForRequest(req, userId);
            if (enabled && !canPurchaseTokens(wallet.plan)) {
                return void res.status(400).json({
                    detail: "Auto-recharge is available on Personal and Enterprise plans.",
                });
            }
            const { data, error } = await db
                .from("wallets")
                .update({
                    auto_recharge_enabled: enabled,
                    auto_recharge_packs: packs,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", wallet.id)
                .select("*")
                .single();
            if (error) throw error;
            const next = await resolveWallet(
                db,
                userId,
                wallet.organization_id,
            );
            res.json({ wallet: serializeWallet(next, isStripeConfigured()) });
        } catch (error) {
            res.status(500).json({ detail: errorMessage(error) });
        }
    },
);

billingRouter.post(
    "/seats",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        const userId = res.locals.userId as string;
        const organizationId =
            typeof req.body?.organizationId === "string"
                ? req.body.organizationId
                : "";
        const seats = Math.max(1, Number(req.body?.seats) || 1);
        try {
            const db = createServerSupabase();
            const membership = await getMembership(db, organizationId, userId);
            if (!membership || !canManageOrgSettings(membership.role)) {
                return void res.status(403).json({ detail: "Forbidden" });
            }
            const occupied = await countOrgOccupiedSeats(db, organizationId);
            if (seats < occupied) {
                return void res.status(400).json({
                    detail: `You have ${occupied} occupied seats. Remove members or invites before reducing seats.`,
                });
            }
            const wallet = await ensureOrgWallet(db, organizationId);
            if (!wallet.stripe_subscription_id) {
                return void res.status(400).json({
                    detail: "Start an Enterprise subscription before changing seats.",
                });
            }
            await updateSubscriptionSeats(wallet.stripe_subscription_id, seats);
            res.json({ ok: true, seats });
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                return void res.status(503).json({
                    code: error.code,
                    detail: error.message,
                });
            }
            res.status(500).json({ detail: errorMessage(error) });
        }
    },
);
