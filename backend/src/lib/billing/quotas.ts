export const PLAN_IDS = ["free", "personal", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PERSONAL_PRICE_USD = 20;
export const ENTERPRISE_SEAT_PRICE_USD = 40;
export const TOKEN_PACK_PRICE_USD = 10;
export const TOKEN_PACK_TOKENS = 1_000_000;

export const INCLUDED_TOKENS: Record<PlanId, number> = {
    free: 50_000,
    personal: 2_000_000,
    enterprise: 2_000_000,
};

export const MODEL_TOKEN_MULTIPLIERS: Record<string, number> = {
    "claude-haiku-4-5": 1,
    "claude-sonnet-4-6": 2,
    "claude-opus-4-6": 4,
    "claude-opus-4-7": 4,
    "claude-opus-4-8": 4,
    "claude-fable-5": 2,
    "gemini-3-flash-preview": 1,
    "gemini-3.5-flash": 1,
    "gemini-3.1-pro-preview": 3,
    "gemini-3.1-flash-lite-preview": 0.5,
    "gpt-5.4": 2,
    "gpt-5.4-lite": 1,
    "gpt-5.4-mini": 1,
    "gpt-5.5": 2,
};

export function isPlanId(value: unknown): value is PlanId {
    return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function includedTokensFor(plan: PlanId, seats = 1): number {
    const base = INCLUDED_TOKENS[plan];
    if (plan === "enterprise") {
        return base * Math.max(1, seats);
    }
    return base;
}

export function billedTokensForUsage(args: {
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
}): number {
    const input = Math.max(0, args.inputTokens ?? 0);
    const output = Math.max(0, args.outputTokens ?? 0);
    const raw = input + output;
    if (raw <= 0) return 0;
    const multiplier =
        (args.model && MODEL_TOKEN_MULTIPLIERS[args.model]) || 1;
    return Math.max(1, Math.ceil(raw * multiplier));
}

export function canPurchaseTokens(plan: PlanId): boolean {
    return plan === "personal" || plan === "enterprise";
}

export function canCollaborate(plan: PlanId): boolean {
    return plan === "enterprise";
}
