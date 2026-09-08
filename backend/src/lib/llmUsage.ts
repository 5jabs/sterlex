import type { createServerSupabase } from "./supabase";
import type { ResolvedApiKeySource } from "./apiKeyResolution";
import type { LlmTokenUsage } from "./llm/tokenUsage";
import { hasTokenUsage } from "./llm/tokenUsage";
import {
    DEFAULT_MAIN_MODEL,
    providerForModel,
    resolveModel,
} from "./llm/models";
import type { BudgetEnforcement } from "./organizationRoles";

type Db = ReturnType<typeof createServerSupabase>;

export type LlmUsageEventInput = {
    organizationId?: string | null;
    userId?: string | null;
    projectId?: string | null;
    provider: string;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    keySource?: ResolvedApiKeySource;
};

export type LlmMetering = {
    db: Db;
    userId?: string | null;
    organizationId?: string | null;
    projectId?: string | null;
    keySource?: ResolvedApiKeySource;
};

export type BudgetAction = "allow" | "warn" | "block";

export class OrganizationBudgetExceededError extends Error {
    code = "org_budget_exceeded" as const;
    estimatedCostUsd: number;
    monthlyBudgetUsd: number;

    constructor(estimatedCostUsd: number, monthlyBudgetUsd: number) {
        super(
            `This organization has reached its monthly budget of ${monthlyBudgetUsd.toLocaleString(
                undefined,
                { style: "currency", currency: "USD" },
            )}.`,
        );
        this.name = "OrganizationBudgetExceededError";
        this.estimatedCostUsd = estimatedCostUsd;
        this.monthlyBudgetUsd = monthlyBudgetUsd;
    }
}

/** Rough public list prices used only for internal estimates, not invoices. */
const MODEL_PRICE_PER_MILLION: Record<
    string,
    { input: number; output: number }
> = {
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-opus-4-6": { input: 5, output: 25 },
    "claude-opus-4-7": { input: 5, output: 25 },
    "claude-opus-4-8": { input: 5, output: 25 },
    "claude-fable-5": { input: 3, output: 15 },
    "gemini-3-flash-preview": { input: 0.5, output: 3 },
    "gemini-3.5-flash": { input: 0.5, output: 3 },
    "gemini-3.1-pro-preview": { input: 1.25, output: 10 },
    "gemini-3.1-flash-lite-preview": { input: 0.1, output: 0.4 },
    "gpt-5.4": { input: 2.5, output: 15 },
    "gpt-5.4-lite": { input: 0.4, output: 1.6 },
    "gpt-5.4-mini": { input: 0.4, output: 1.6 },
    "gpt-5.5": { input: 2.5, output: 15 },
};

export function estimateLlmCostUsd(args: {
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
}): number {
    const inputTokens = Math.max(0, args.inputTokens ?? 0);
    const outputTokens = Math.max(0, args.outputTokens ?? 0);
    const prices =
        (args.model && MODEL_PRICE_PER_MILLION[args.model]) || {
            input: 1,
            output: 5,
        };
    const usd =
        (inputTokens / 1_000_000) * prices.input +
        (outputTokens / 1_000_000) * prices.output;
    return Math.round(usd * 1_000_000) / 1_000_000;
}

export function isOverBudget(
    estimatedCostUsd: number,
    monthlyBudgetUsd: number | null | undefined,
): boolean {
    if (monthlyBudgetUsd == null || !Number.isFinite(monthlyBudgetUsd)) {
        return false;
    }
    return estimatedCostUsd >= monthlyBudgetUsd;
}

export function budgetAction(
    enforcement: BudgetEnforcement | string | null | undefined,
    overBudget: boolean,
): BudgetAction {
    if (!overBudget) return "allow";
    if (enforcement === "hard") return "block";
    if (enforcement === "soft") return "warn";
    return "allow";
}

export function currentUtcMonthRange(now = new Date()): {
    start: string;
    end: string;
} {
    const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { start: start.toISOString(), end: end.toISOString() };
}

export async function recordLlmUsageEvent(
    db: Db,
    input: LlmUsageEventInput,
): Promise<void> {
    const estimatedCostUsd =
        input.estimatedCostUsd ??
        estimateLlmCostUsd({
            model: input.model,
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
        });
    const { error } = await db.from("llm_usage_events").insert({
        organization_id: input.organizationId ?? null,
        user_id: input.userId ?? null,
        project_id: input.projectId ?? null,
        provider: input.provider,
        model: input.model ?? null,
        input_tokens: Math.max(0, input.inputTokens ?? 0),
        output_tokens: Math.max(0, input.outputTokens ?? 0),
        estimated_cost_usd: estimatedCostUsd,
        key_source: input.keySource ?? null,
    });
    if (error) {
        console.error("[llm-usage] failed to record event", error.message);
    }
}

export async function summarizeOrganizationUsage(
    db: Db,
    organizationId: string,
    range = currentUtcMonthRange(),
) {
    const { data, error } = await db
        .from("llm_usage_events")
        .select(
            "provider, model, input_tokens, output_tokens, estimated_cost_usd, user_id, key_source",
        )
        .eq("organization_id", organizationId)
        .gte("created_at", range.start)
        .lt("created_at", range.end);
    if (error) throw error;

    const rows = data ?? [];
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    const byProvider: Record<
        string,
        { inputTokens: number; outputTokens: number; estimatedCostUsd: number }
    > = {};

    for (const row of rows) {
        const input = Number(row.input_tokens) || 0;
        const output = Number(row.output_tokens) || 0;
        const cost = Number(row.estimated_cost_usd) || 0;
        inputTokens += input;
        outputTokens += output;
        estimatedCostUsd += cost;
        const provider = String(row.provider || "unknown");
        const bucket = byProvider[provider] ?? {
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
        };
        bucket.inputTokens += input;
        bucket.outputTokens += output;
        bucket.estimatedCostUsd += cost;
        byProvider[provider] = bucket;
    }

    return {
        periodStart: range.start,
        periodEnd: range.end,
        eventCount: rows.length,
        inputTokens,
        outputTokens,
        estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
        byProvider,
    };
}

export async function assertOrganizationBudgetAllowed(
    db: Db,
    organizationId: string | null | undefined,
) {
    if (!organizationId) return { warning: false as const };
    const { data, error } = await db
        .from("organizations")
        .select("monthly_budget_usd, budget_enforcement")
        .eq("id", organizationId)
        .maybeSingle();
    if (error) throw error;
    const monthlyBudgetUsd =
        data?.monthly_budget_usd == null ? null : Number(data.monthly_budget_usd);
    const enforcement = (data?.budget_enforcement ?? "off") as BudgetEnforcement;
    if (enforcement === "off" || monthlyBudgetUsd == null) {
        return { warning: false as const };
    }
    const usage = await summarizeOrganizationUsage(db, organizationId);
    const overBudget = isOverBudget(usage.estimatedCostUsd, monthlyBudgetUsd);
    const action = budgetAction(enforcement, overBudget);
    if (action === "block") {
        throw new OrganizationBudgetExceededError(
            usage.estimatedCostUsd,
            monthlyBudgetUsd,
        );
    }
    return {
        warning: action === "warn",
        estimatedCostUsd: usage.estimatedCostUsd,
        monthlyBudgetUsd,
    };
}

export async function persistLlmMetering(
    metering: LlmMetering | null | undefined,
    provider: string,
    model: string,
    usage: LlmTokenUsage | null | undefined,
): Promise<void> {
    if (!metering || !hasTokenUsage(usage)) return;
    await recordLlmUsageEvent(metering.db, {
        organizationId: metering.organizationId,
        userId: metering.userId,
        projectId: metering.projectId,
        provider,
        model,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        keySource: metering.keySource,
    });
}

export function orgBudgetErrorPayload(err: OrganizationBudgetExceededError) {
    return {
        code: err.code,
        detail: err.message,
        estimatedCostUsd: err.estimatedCostUsd,
        monthlyBudgetUsd: err.monthlyBudgetUsd,
    };
}

export async function tryOrgBudgetGuard(
    db: Db,
    organizationId: string | null | undefined,
    res: {
        headersSent: boolean;
        status(code: number): { json(body: unknown): unknown };
    },
): Promise<boolean> {
    try {
        await assertOrganizationBudgetAllowed(db, organizationId);
        return true;
    } catch (err) {
        if (err instanceof OrganizationBudgetExceededError) {
            if (!res.headersSent) {
                res.status(402).json(orgBudgetErrorPayload(err));
            }
            return false;
        }
        throw err;
    }
}

export function withBudgetFields(
    usage: Awaited<ReturnType<typeof summarizeOrganizationUsage>>,
    monthlyBudgetUsd: number | null,
    budgetEnforcement: BudgetEnforcement | string | null,
) {
    const overBudget = isOverBudget(usage.estimatedCostUsd, monthlyBudgetUsd);
    const remainingUsd =
        monthlyBudgetUsd == null
            ? null
            : Math.max(
                  0,
                  Math.round(
                      (monthlyBudgetUsd - usage.estimatedCostUsd) * 1_000_000,
                  ) / 1_000_000,
              );
    return {
        ...usage,
        monthlyBudgetUsd,
        budgetEnforcement,
        overBudget,
        remainingUsd,
    };
}

export function meteringFromSettings(args: {
    db: Db;
    userId: string;
    projectId?: string | null;
    organizationId?: string | null;
    model?: string | null;
    apiKeySources?: Record<string, string | null | undefined>;
    keySource?: ResolvedApiKeySource;
}): LlmMetering {
    let keySource = args.keySource ?? null;
    if (!keySource) {
        try {
            const provider = providerForModel(
                resolveModel(args.model, DEFAULT_MAIN_MODEL),
            );
            const fromSources = args.apiKeySources?.[provider];
            if (
                fromSources === "org" ||
                fromSources === "user" ||
                fromSources === "env"
            ) {
                keySource = fromSources;
            }
        } catch {
            keySource = null;
        }
    }
    if (!keySource && args.organizationId) keySource = "org";
    return {
        db: args.db,
        userId: args.userId,
        organizationId: args.organizationId ?? null,
        projectId: args.projectId ?? null,
        keySource,
    };
}
