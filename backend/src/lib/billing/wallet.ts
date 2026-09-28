import type { createServerSupabase } from "../supabase";
import {
    type PlanId,
    billedTokensForUsage,
    canPurchaseTokens,
    includedTokensFor,
    isPlanId,
} from "./quotas";
import { InsufficientTokensError, PastDueError } from "./errors";

type Db = ReturnType<typeof createServerSupabase>;

export type WalletRow = {
    id: string;
    owner_type: "user" | "organization";
    user_id: string | null;
    organization_id: string | null;
    plan: PlanId;
    seats: number;
    included_tokens_grant: number;
    included_tokens_remaining: number;
    included_reset_at: string;
    prepaid_tokens: number;
    auto_recharge_enabled: boolean;
    auto_recharge_packs: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    default_payment_method_id: string | null;
    subscription_status: string | null;
    past_due: boolean;
    created_at: string;
    updated_at: string;
};

export type WalletView = {
    id: string;
    ownerType: "user" | "organization";
    plan: PlanId;
    seats: number;
    includedTokensGrant: number;
    includedTokensRemaining: number;
    includedResetAt: string;
    prepaidTokens: number;
    availableTokens: number;
    autoRechargeEnabled: boolean;
    autoRechargePacks: number;
    subscriptionStatus: string | null;
    pastDue: boolean;
    canPurchaseTokens: boolean;
    stripeConfigured: boolean;
};

function asWallet(row: Record<string, unknown>): WalletRow {
    const plan = isPlanId(row.plan) ? row.plan : "free";
    return {
        id: String(row.id),
        owner_type: row.owner_type === "organization" ? "organization" : "user",
        user_id: (row.user_id as string | null) ?? null,
        organization_id: (row.organization_id as string | null) ?? null,
        plan,
        seats: Number(row.seats) || 1,
        included_tokens_grant: Number(row.included_tokens_grant) || 0,
        included_tokens_remaining: Number(row.included_tokens_remaining) || 0,
        included_reset_at: String(row.included_reset_at),
        prepaid_tokens: Number(row.prepaid_tokens) || 0,
        auto_recharge_enabled: row.auto_recharge_enabled === true,
        auto_recharge_packs: Math.max(1, Number(row.auto_recharge_packs) || 1),
        stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
        stripe_subscription_id:
            (row.stripe_subscription_id as string | null) ?? null,
        stripe_price_id: (row.stripe_price_id as string | null) ?? null,
        default_payment_method_id:
            (row.default_payment_method_id as string | null) ?? null,
        subscription_status: (row.subscription_status as string | null) ?? null,
        past_due: row.past_due === true,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
}

export function serializeWallet(
    wallet: WalletRow,
    stripeConfigured: boolean,
): WalletView {
    const available =
        wallet.included_tokens_remaining + wallet.prepaid_tokens;
    return {
        id: wallet.id,
        ownerType: wallet.owner_type,
        plan: wallet.plan,
        seats: wallet.seats,
        includedTokensGrant: wallet.included_tokens_grant,
        includedTokensRemaining: wallet.included_tokens_remaining,
        includedResetAt: wallet.included_reset_at,
        prepaidTokens: wallet.prepaid_tokens,
        availableTokens: available,
        autoRechargeEnabled: wallet.auto_recharge_enabled,
        autoRechargePacks: wallet.auto_recharge_packs,
        subscriptionStatus: wallet.subscription_status,
        pastDue: wallet.past_due,
        canPurchaseTokens: canPurchaseTokens(wallet.plan),
        stripeConfigured,
    };
}

export function availableTokens(wallet: WalletRow): number {
    return wallet.included_tokens_remaining + wallet.prepaid_tokens;
}

async function insertLedger(
    db: Db,
    row: {
        walletId: string;
        userId?: string | null;
        reason: string;
        billedTokens: number;
        includedDelta?: number;
        prepaidDelta?: number;
        llmInput?: number;
        llmOutput?: number;
        model?: string | null;
        stripeEventId?: string | null;
        metadata?: Record<string, unknown>;
    },
) {
    const { error } = await db.from("token_ledger").insert({
        wallet_id: row.walletId,
        user_id: row.userId ?? null,
        reason: row.reason,
        billed_tokens: row.billedTokens,
        included_delta: row.includedDelta ?? 0,
        prepaid_delta: row.prepaidDelta ?? 0,
        llm_input_tokens: row.llmInput ?? 0,
        llm_output_tokens: row.llmOutput ?? 0,
        model: row.model ?? null,
        stripe_event_id: row.stripeEventId ?? null,
        metadata: row.metadata ?? {},
    });
    if (error) {
        console.error("[billing] failed to write ledger", error.message);
    }
}

export async function getWalletById(db: Db, walletId: string) {
    const { data, error } = await db
        .from("wallets")
        .select("*")
        .eq("id", walletId)
        .maybeSingle();
    if (error) throw error;
    return data ? asWallet(data as Record<string, unknown>) : null;
}

export async function ensureUserWallet(db: Db, userId: string): Promise<WalletRow> {
    const { data, error } = await db
        .from("wallets")
        .select("*")
        .eq("owner_type", "user")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw error;
    if (data) return refreshPeriodIfNeeded(db, asWallet(data as Record<string, unknown>));

    const grant = includedTokensFor("free");
    const reset = new Date();
    reset.setDate(reset.getDate() + 30);
    const { data: created, error: createError } = await db
        .from("wallets")
        .insert({
            owner_type: "user",
            user_id: userId,
            plan: "free",
            seats: 1,
            included_tokens_grant: grant,
            included_tokens_remaining: grant,
            included_reset_at: reset.toISOString(),
        })
        .select("*")
        .single();
    if (createError) {
        const raced = await db
            .from("wallets")
            .select("*")
            .eq("owner_type", "user")
            .eq("user_id", userId)
            .maybeSingle();
        if (raced.data) {
            return refreshPeriodIfNeeded(
                db,
                asWallet(raced.data as Record<string, unknown>),
            );
        }
        throw createError;
    }
    await insertLedger(db, {
        walletId: created.id as string,
        userId,
        reason: "period_grant",
        billedTokens: grant,
        includedDelta: grant,
        metadata: { plan: "free" },
    });
    return asWallet(created as Record<string, unknown>);
}

export async function ensureOrgWallet(
    db: Db,
    organizationId: string,
): Promise<WalletRow> {
    const { data, error } = await db
        .from("wallets")
        .select("*")
        .eq("owner_type", "organization")
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error) throw error;
    if (data) return refreshPeriodIfNeeded(db, asWallet(data as Record<string, unknown>));

    const { data: created, error: createError } = await db
        .from("wallets")
        .insert({
            owner_type: "organization",
            organization_id: organizationId,
            plan: "enterprise",
            seats: 1,
            included_tokens_grant: 0,
            included_tokens_remaining: 0,
            included_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            subscription_status: "incomplete",
        })
        .select("*")
        .single();
    if (createError) {
        const raced = await db
            .from("wallets")
            .select("*")
            .eq("owner_type", "organization")
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (raced.data) {
            return refreshPeriodIfNeeded(
                db,
                asWallet(raced.data as Record<string, unknown>),
            );
        }
        throw createError;
    }
    return asWallet(created as Record<string, unknown>);
}

export async function resolveWallet(
    db: Db,
    userId: string,
    organizationId?: string | null,
): Promise<WalletRow> {
    if (organizationId) return ensureOrgWallet(db, organizationId);
    return ensureUserWallet(db, userId);
}

export async function refreshPeriodIfNeeded(
    db: Db,
    wallet: WalletRow,
): Promise<WalletRow> {
    if (new Date(wallet.included_reset_at).getTime() > Date.now()) {
        return wallet;
    }
    const grant = includedTokensFor(wallet.plan, wallet.seats);
    const reset = new Date();
    reset.setDate(reset.getDate() + 30);
    const { data, error } = await db
        .from("wallets")
        .update({
            included_tokens_grant: grant,
            included_tokens_remaining: grant,
            included_reset_at: reset.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id)
        .select("*")
        .single();
    if (error) throw error;
    await insertLedger(db, {
        walletId: wallet.id,
        reason: "period_grant",
        billedTokens: grant,
        includedDelta: grant,
        metadata: { plan: wallet.plan, seats: wallet.seats },
    });
    return asWallet(data as Record<string, unknown>);
}

export async function applyPeriodGrant(
    db: Db,
    walletId: string,
    args: {
        plan: PlanId;
        seats: number;
        resetAt: Date;
        stripeEventId?: string | null;
    },
) {
    const grant = includedTokensFor(args.plan, args.seats);
    const { data, error } = await db
        .from("wallets")
        .update({
            plan: args.plan,
            seats: args.seats,
            included_tokens_grant: grant,
            included_tokens_remaining: grant,
            included_reset_at: args.resetAt.toISOString(),
            past_due: false,
            updated_at: new Date().toISOString(),
        })
        .eq("id", walletId)
        .select("*")
        .single();
    if (error) throw error;
    await insertLedger(db, {
        walletId,
        reason: "period_grant",
        billedTokens: grant,
        includedDelta: grant,
        stripeEventId: args.stripeEventId,
        metadata: { plan: args.plan, seats: args.seats },
    });
    return asWallet(data as Record<string, unknown>);
}

export async function creditPrepaid(
    db: Db,
    walletId: string,
    tokens: number,
    args: {
        reason: "pack_purchase" | "auto_recharge" | "adjustment";
        userId?: string | null;
        stripeEventId?: string | null;
        metadata?: Record<string, unknown>;
    },
) {
    const amount = Math.max(0, Math.floor(tokens));
    if (!amount) return getWalletById(db, walletId);
    const { data: current, error: loadError } = await db
        .from("wallets")
        .select("prepaid_tokens")
        .eq("id", walletId)
        .single();
    if (loadError) throw loadError;
    const next = Number(current.prepaid_tokens || 0) + amount;
    const { data, error } = await db
        .from("wallets")
        .update({
            prepaid_tokens: next,
            updated_at: new Date().toISOString(),
        })
        .eq("id", walletId)
        .select("*")
        .single();
    if (error) throw error;
    await insertLedger(db, {
        walletId,
        userId: args.userId,
        reason: args.reason,
        billedTokens: amount,
        prepaidDelta: amount,
        stripeEventId: args.stripeEventId,
        metadata: args.metadata,
    });
    return asWallet(data as Record<string, unknown>);
}

export async function assertCanSpend(
    db: Db,
    wallet: WalletRow,
): Promise<WalletRow> {
    const current = await refreshPeriodIfNeeded(db, wallet);
    if (current.past_due) throw new PastDueError();
    if (availableTokens(current) > 0) return current;
    throw new InsufficientTokensError(current.plan, availableTokens(current));
}

export async function debitUsage(
    db: Db,
    args: {
        wallet: WalletRow;
        userId?: string | null;
        model?: string | null;
        inputTokens?: number;
        outputTokens?: number;
    },
): Promise<{ billedTokens: number; wallet: WalletRow | null }> {
    const billedTokens = billedTokensForUsage({
        model: args.model,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
    });
    if (billedTokens <= 0) {
        return { billedTokens: 0, wallet: args.wallet };
    }

    const { data, error } = await db.rpc("debit_wallet", {
        p_wallet_id: args.wallet.id,
        p_tokens: billedTokens,
    });
    if (error) throw error;
    const result = data as {
        ok?: boolean;
        code?: string;
        included?: number;
        prepaid?: number;
        available?: number;
        plan?: string;
    } | null;
    if (!result?.ok) {
        if (result?.code === "past_due") throw new PastDueError();
        throw new InsufficientTokensError(
            isPlanId(result?.plan) ? result.plan : args.wallet.plan,
            Number(result?.available) || 0,
        );
    }
    await insertLedger(db, {
        walletId: args.wallet.id,
        userId: args.userId,
        reason: "llm_usage",
        billedTokens: -billedTokens,
        includedDelta: -(Number(result.included) || 0),
        prepaidDelta: -(Number(result.prepaid) || 0),
        llmInput: args.inputTokens,
        llmOutput: args.outputTokens,
        model: args.model,
    });
    return { billedTokens, wallet: await getWalletById(db, args.wallet.id) };
}

export async function listLedger(
    db: Db,
    walletId: string,
    limit = 50,
) {
    const { data, error } = await db
        .from("token_ledger")
        .select(
            "id, reason, billed_tokens, included_delta, prepaid_delta, llm_input_tokens, llm_output_tokens, model, created_at, metadata",
        )
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data ?? [];
}

export async function countOrgOccupiedSeats(db: Db, organizationId: string) {
    const [{ count: members }, { count: invites }] = await Promise.all([
        db
            .from("organization_members")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),
        db
            .from("organization_invites")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "pending"),
    ]);
    return (members ?? 0) + (invites ?? 0);
}
