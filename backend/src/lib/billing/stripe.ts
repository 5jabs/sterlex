import Stripe from "stripe";
import type { createServerSupabase } from "../supabase";
import { BillingNotConfiguredError } from "./errors";
import {
    ENTERPRISE_SEAT_PRICE_USD,
    PERSONAL_PRICE_USD,
    TOKEN_PACK_PRICE_USD,
    TOKEN_PACK_TOKENS,
    type PlanId,
} from "./quotas";
import {
    type WalletRow,
    applyPeriodGrant,
    creditPrepaid,
    getWalletById,
} from "./wallet";
import { sendBillingEmail } from "../email";

type Db = ReturnType<typeof createServerSupabase>;

let stripeClient: Stripe | null | undefined;

export function isStripeConfigured() {
    return Boolean(
        process.env.STRIPE_SECRET_KEY?.trim() &&
            process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    );
}

export function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new BillingNotConfiguredError();
    if (!stripeClient) {
        stripeClient = new Stripe(key);
    }
    return stripeClient;
}

function frontendUrl(path = "") {
    const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
        /\/+$/,
        "",
    );
    return `${base}${path}`;
}

function priceIdForPlan(plan: "personal" | "enterprise") {
    return plan === "personal"
        ? process.env.STRIPE_PRICE_PERSONAL?.trim()
        : process.env.STRIPE_PRICE_ENTERPRISE_SEAT?.trim();
}

function packPriceId() {
    return process.env.STRIPE_PRICE_TOKEN_PACK?.trim();
}

export async function ensureStripeCustomer(
    db: Db,
    wallet: WalletRow,
    email: string,
) {
    if (wallet.stripe_customer_id) return wallet.stripe_customer_id;
    const stripe = getStripe();
    const customer = await stripe.customers.create({
        email,
        metadata: {
            wallet_id: wallet.id,
            owner_type: wallet.owner_type,
            user_id: wallet.user_id ?? "",
            organization_id: wallet.organization_id ?? "",
        },
    });
    const { error } = await db
        .from("wallets")
        .update({
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
    if (error) throw error;
    return customer.id;
}

export async function createSubscriptionCheckout(args: {
    db: Db;
    wallet: WalletRow;
    email: string;
    plan: "personal" | "enterprise";
    seats: number;
    userId: string;
    organizationId?: string | null;
}) {
    const stripe = getStripe();
    const customer = await ensureStripeCustomer(args.db, args.wallet, args.email);
    const price = priceIdForPlan(args.plan);
    const quantity = args.plan === "enterprise" ? Math.max(1, args.seats) : 1;
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        client_reference_id: args.userId,
        success_url: frontendUrl("/account/billing?checkout=success"),
        cancel_url: frontendUrl("/pricing?checkout=cancel"),
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        line_items: price
            ? [{ price, quantity }]
            : [
                  {
                      quantity,
                      price_data: {
                          currency: "usd",
                          recurring: { interval: "month" },
                          unit_amount:
                              (args.plan === "personal"
                                  ? PERSONAL_PRICE_USD
                                  : ENTERPRISE_SEAT_PRICE_USD) * 100,
                          product_data: {
                              name:
                                  args.plan === "personal"
                                      ? "Sterlex Personal"
                                      : "Sterlex Enterprise seat",
                          },
                      },
                  },
              ],
        metadata: {
            wallet_id: args.wallet.id,
            user_id: args.userId,
            plan: args.plan,
            organization_id: args.organizationId ?? "",
            seats: String(quantity),
        },
        subscription_data: {
            metadata: {
                wallet_id: args.wallet.id,
                user_id: args.userId,
                plan: args.plan,
                organization_id: args.organizationId ?? "",
            },
        },
    });
    return session.url;
}

export async function createPackCheckout(args: {
    db: Db;
    wallet: WalletRow;
    email: string;
    packs: number;
    userId: string;
}) {
    const stripe = getStripe();
    const packs = Math.max(1, Math.min(20, Math.floor(args.packs)));
    const customer = await ensureStripeCustomer(args.db, args.wallet, args.email);
    const price = packPriceId();
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer,
        client_reference_id: args.userId,
        success_url: frontendUrl("/account/billing?pack=success"),
        cancel_url: frontendUrl("/account/billing?pack=cancel"),
        line_items: price
            ? [{ price, quantity: packs }]
            : [
                  {
                      quantity: packs,
                      price_data: {
                          currency: "usd",
                          unit_amount: TOKEN_PACK_PRICE_USD * 100,
                          product_data: {
                              name: "Sterlex token pack",
                              description: `${TOKEN_PACK_TOKENS.toLocaleString()} tokens`,
                          },
                      },
                  },
              ],
        metadata: {
            wallet_id: args.wallet.id,
            user_id: args.userId,
            kind: "token_pack",
            packs: String(packs),
        },
        payment_intent_data: {
            setup_future_usage: "off_session",
            metadata: {
                wallet_id: args.wallet.id,
                kind: "token_pack",
                packs: String(packs),
            },
        },
    });
    return session.url;
}

export async function createBillingPortal(customerId: string) {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: frontendUrl("/account/billing"),
    });
    return session.url;
}

export async function updateSubscriptionSeats(
    subscriptionId: string,
    seats: number,
) {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new Error("Subscription has no items");
    await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, quantity: Math.max(1, seats) }],
        proration_behavior: "create_prorations",
    });
}

export async function tryAutoRecharge(db: Db, wallet: WalletRow) {
    if (!isStripeConfigured()) return null;
    if (!wallet.stripe_customer_id || !wallet.default_payment_method_id) {
        return null;
    }
    const packs = Math.max(1, wallet.auto_recharge_packs);
    try {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
            amount: TOKEN_PACK_PRICE_USD * 100 * packs,
            currency: "usd",
            customer: wallet.stripe_customer_id,
            payment_method: wallet.default_payment_method_id,
            off_session: true,
            confirm: true,
            metadata: {
                wallet_id: wallet.id,
                kind: "auto_recharge",
                packs: String(packs),
            },
        });
        if (intent.status !== "succeeded") return null;
        return creditPrepaid(db, wallet.id, TOKEN_PACK_TOKENS * packs, {
            reason: "auto_recharge",
            stripeEventId: intent.id,
            metadata: { packs },
        });
    } catch (error) {
        console.error("[billing] auto-recharge failed", error);
        await db
            .from("wallets")
            .update({
                past_due: true,
                updated_at: new Date().toISOString(),
            })
            .eq("id", wallet.id);
        return null;
    }
}

export async function rememberPaymentMethod(
    db: Db,
    walletId: string,
    customerId: string,
    paymentMethodId: string | null | undefined,
) {
    if (!paymentMethodId) return;
    await db
        .from("wallets")
        .update({
            stripe_customer_id: customerId,
            default_payment_method_id: paymentMethodId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", walletId);
}

export async function upsertSubscriptionRecord(
    db: Db,
    args: {
        wallet: WalletRow;
        subscription: Stripe.Subscription;
        plan: PlanId;
        stripeEventId?: string;
    },
) {
    const sub = args.subscription;
    const item = sub.items.data[0];
    const seats = item?.quantity ?? args.wallet.seats ?? 1;
    const periodEndUnix =
        (item as { current_period_end?: number } | undefined)
            ?.current_period_end ??
        (sub as { current_period_end?: number }).current_period_end;
    const periodStartUnix =
        (item as { current_period_start?: number } | undefined)
            ?.current_period_start ??
        (sub as { current_period_start?: number }).current_period_start;
    const periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const periodStart = periodStartUnix
        ? new Date(periodStartUnix * 1000)
        : new Date();
    const status = sub.status;
    const pastDue = status === "past_due" || status === "unpaid";
    const plan: PlanId =
        args.plan === "enterprise" || args.plan === "personal"
            ? args.plan
            : args.wallet.owner_type === "organization"
              ? "enterprise"
              : "personal";

    await db.from("billing_subscriptions").upsert(
        {
            wallet_id: args.wallet.id,
            stripe_customer_id: String(sub.customer),
            stripe_subscription_id: sub.id,
            stripe_price_id: item?.price?.id ?? null,
            plan,
            status,
            seats,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end === true,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
    );

    await db
        .from("wallets")
        .update({
            stripe_customer_id: String(sub.customer),
            stripe_subscription_id: sub.id,
            stripe_price_id: item?.price?.id ?? null,
            subscription_status: status,
            past_due: pastDue,
            seats,
            plan,
            default_payment_method_id:
                typeof sub.default_payment_method === "string"
                    ? sub.default_payment_method
                    : args.wallet.default_payment_method_id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", args.wallet.id);

    if (status === "active" || status === "trialing") {
        await applyPeriodGrant(db, args.wallet.id, {
            plan,
            seats,
            resetAt: periodEnd,
            stripeEventId: args.stripeEventId,
        });
        const profileEmail = await walletOwnerEmail(db, args.wallet);
        if (profileEmail) {
            await sendBillingEmail({
                to: profileEmail,
                kind: "subscription_active",
                plan,
            });
        }
    }
}

async function walletOwnerEmail(db: Db, wallet: WalletRow) {
    if (wallet.user_id) {
        const { data } = await db
            .from("user_profiles")
            .select("email")
            .eq("user_id", wallet.user_id)
            .maybeSingle();
        return (data?.email as string | null) ?? null;
    }
    if (wallet.organization_id) {
        const { data: owner } = await db
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", wallet.organization_id)
            .eq("role", "owner")
            .maybeSingle();
        if (!owner?.user_id) return null;
        const { data } = await db
            .from("user_profiles")
            .select("email")
            .eq("user_id", owner.user_id)
            .maybeSingle();
        return (data?.email as string | null) ?? null;
    }
    return null;
}

export async function markCanceled(db: Db, wallet: WalletRow) {
    const plan: PlanId =
        wallet.owner_type === "organization" ? "enterprise" : "free";
    await db
        .from("wallets")
        .update({
            plan,
            subscription_status: "canceled",
            stripe_subscription_id: null,
            past_due: false,
            included_tokens_grant:
                plan === "free" ? 50_000 : wallet.included_tokens_grant,
            seats: plan === "enterprise" ? wallet.seats : 1,
            updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
}

export { TOKEN_PACK_TOKENS };

export async function loadWalletForCustomer(db: Db, customerId: string) {
    const { data, error } = await db
        .from("wallets")
        .select("*")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
    if (error) throw error;
    return data ? await getWalletById(db, data.id as string) : null;
}
