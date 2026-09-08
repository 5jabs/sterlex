import type { createServerSupabase } from "./supabase";
import type { ResolvedApiKeySource } from "./apiKeyResolution";

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

/** Rough public list prices used only for internal estimates, not invoices. */
const MODEL_PRICE_PER_MILLION: Record<
    string,
    { input: number; output: number }
> = {
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-opus-4-6": { input: 5, output: 25 },
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-3-flash-preview": { input: 0.5, output: 3 },
    "gemini-3.1-pro-preview": { input: 1.25, output: 10 },
    "gpt-5.4": { input: 2.5, output: 15 },
    "gpt-5.4-mini": { input: 0.4, output: 1.6 },
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
