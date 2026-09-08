export type LlmTokenUsage = {
    inputTokens: number;
    outputTokens: number;
};

export function emptyTokenUsage(): LlmTokenUsage {
    return { inputTokens: 0, outputTokens: 0 };
}

export function addTokenUsage(
    current: LlmTokenUsage,
    extra: LlmTokenUsage | null | undefined,
): LlmTokenUsage {
    if (!extra) return current;
    return {
        inputTokens: current.inputTokens + Math.max(0, extra.inputTokens || 0),
        outputTokens: current.outputTokens + Math.max(0, extra.outputTokens || 0),
    };
}

function asNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function fromTokenFields(record: Record<string, unknown> | null | undefined) {
    if (!record) return emptyTokenUsage();
    const inputTokens =
        asNumber(record.input_tokens) ||
        asNumber(record.prompt_tokens) ||
        asNumber(record.promptTokenCount) ||
        asNumber(record.inputTokenCount);
    const outputTokens =
        asNumber(record.output_tokens) ||
        asNumber(record.completion_tokens) ||
        asNumber(record.candidatesTokenCount) + asNumber(record.thoughtsTokenCount) ||
        asNumber(record.outputTokenCount);
    return { inputTokens, outputTokens };
}

export function tokenUsageFromClaude(value: unknown): LlmTokenUsage {
    if (!value || typeof value !== "object") return emptyTokenUsage();
    const record = value as Record<string, unknown>;
    const usage =
        record.usage && typeof record.usage === "object"
            ? (record.usage as Record<string, unknown>)
            : record;
    return fromTokenFields(usage);
}

export function tokenUsageFromOpenAI(value: unknown): LlmTokenUsage {
    if (!value || typeof value !== "object") return emptyTokenUsage();
    const record = value as Record<string, unknown>;
    const nestedResponse =
        record.response && typeof record.response === "object"
            ? (record.response as Record<string, unknown>)
            : null;
    const usage =
        (record.usage && typeof record.usage === "object"
            ? (record.usage as Record<string, unknown>)
            : null) ||
        (nestedResponse?.usage && typeof nestedResponse.usage === "object"
            ? (nestedResponse.usage as Record<string, unknown>)
            : null);
    return fromTokenFields(usage);
}

export function tokenUsageFromGemini(value: unknown): LlmTokenUsage {
    if (!value || typeof value !== "object") return emptyTokenUsage();
    const record = value as Record<string, unknown>;
    const usage =
        record.usageMetadata && typeof record.usageMetadata === "object"
            ? (record.usageMetadata as Record<string, unknown>)
            : record;
    const extracted = fromTokenFields(usage);
    if (extracted.inputTokens || extracted.outputTokens) return extracted;
    const total = asNumber(usage.totalTokenCount);
    if (!total) return emptyTokenUsage();
    return { inputTokens: total, outputTokens: 0 };
}

export function hasTokenUsage(usage: LlmTokenUsage | null | undefined): boolean {
    return !!usage && (usage.inputTokens > 0 || usage.outputTokens > 0);
}
