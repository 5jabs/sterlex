import type { createServerSupabase } from "../supabase";
import type { LlmMetering } from "../llmUsage";
import {
    OrganizationBudgetExceededError,
    assertOrganizationBudgetAllowed,
    recordLlmUsageEvent,
} from "../llmUsage";
import type { LlmTokenUsage } from "../llm/tokenUsage";
import { hasTokenUsage } from "../llm/tokenUsage";
import {
    InsufficientTokensError,
    PastDueError,
    billingErrorPayload,
} from "./errors";
import { billedTokensForUsage, canPurchaseTokens } from "./quotas";
import {
    assertCanSpend,
    availableTokens,
    debitUsage,
    resolveWallet,
    type WalletRow,
} from "./wallet";
import { tryAutoRecharge } from "./stripe";
import { isStripeConfigured } from "./stripe";
import { sendBillingEmail } from "../email";

type Db = ReturnType<typeof createServerSupabase>;

export async function assertBillingAllowed(
    db: Db,
    userId: string,
    organizationId?: string | null,
): Promise<WalletRow> {
    let wallet = await resolveWallet(db, userId, organizationId);
    try {
        wallet = await assertCanSpend(db, wallet);
    } catch (err) {
        if (
            err instanceof InsufficientTokensError &&
            wallet.auto_recharge_enabled &&
            canPurchaseTokens(wallet.plan)
        ) {
            const recharged = await tryAutoRecharge(db, wallet);
            if (recharged && availableTokens(recharged) > 0) {
                return recharged;
            }
        }
        throw err;
    }
    if (organizationId) {
        await assertOrganizationBudgetAllowed(db, organizationId);
    }
    return wallet;
}

export async function persistMeteredUsage(
    metering: LlmMetering | null | undefined,
    provider: string,
    model: string,
    usage: LlmTokenUsage | null | undefined,
) {
    if (!metering || !hasTokenUsage(usage)) return;
    const billedTokens = billedTokensForUsage({
        model,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
    });
    await recordLlmUsageEvent(metering.db, {
        organizationId: metering.organizationId,
        userId: metering.userId,
        projectId: metering.projectId,
        provider,
        model,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        billedTokens,
        keySource: metering.keySource,
    });
    if (!metering.userId) return;
    try {
        const wallet = await resolveWallet(
            metering.db,
            metering.userId,
            metering.organizationId,
        );
        const before = availableTokens(wallet);
        await debitUsage(metering.db, {
            wallet,
            userId: metering.userId,
            model,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
        });
        const remaining = before - billedTokens;
        if (
            before > 0 &&
            remaining <= Math.floor(wallet.included_tokens_grant * 0.1) &&
            remaining > 0
        ) {
            const { data } = await metering.db
                .from("user_profiles")
                .select("email")
                .eq("user_id", metering.userId)
                .maybeSingle();
            if (data?.email) {
                await sendBillingEmail({
                    to: String(data.email),
                    kind: "tokens_low",
                });
            }
        }
    } catch (error) {
        console.error("[billing] failed to debit wallet after LLM usage", error);
    }
}

export function billingGuardPayload(err: unknown) {
    if (err instanceof OrganizationBudgetExceededError) {
        return {
            status: 402,
            body: {
                code: err.code,
                detail: err.message,
                estimatedCostUsd: err.estimatedCostUsd,
                monthlyBudgetUsd: err.monthlyBudgetUsd,
            },
        };
    }
    const payload = billingErrorPayload(err);
    if (
        err instanceof InsufficientTokensError ||
        err instanceof PastDueError
    ) {
        return { status: 402, body: payload };
    }
    return null;
}

export async function tryBillingGuard(
    db: Db,
    userId: string,
    organizationId: string | null | undefined,
    res: {
        headersSent: boolean;
        status(code: number): { json(body: unknown): unknown };
    },
): Promise<boolean> {
    try {
        await assertBillingAllowed(db, userId, organizationId);
        return true;
    } catch (err) {
        const mapped = billingGuardPayload(err);
        if (mapped) {
            if (!res.headersSent) res.status(mapped.status).json(mapped.body);
            return false;
        }
        throw err;
    }
}

export { isStripeConfigured };
