import type { PlanId } from "./quotas";

export class InsufficientTokensError extends Error {
    code = "insufficient_tokens" as const;
    plan: PlanId;
    available: number;

    constructor(plan: PlanId, available: number) {
        super(
            plan === "free"
                ? "You've used this month's free tokens. Upgrade to Personal to keep working."
                : "You're out of tokens. Buy a pack or wait for your monthly allowance to reset.",
        );
        this.name = "InsufficientTokensError";
        this.plan = plan;
        this.available = available;
    }
}

export class PastDueError extends Error {
    code = "payment_past_due" as const;

    constructor() {
        super(
            "Your last payment failed. Update your card to keep using Sterlex.",
        );
        this.name = "PastDueError";
    }
}

export class BillingNotConfiguredError extends Error {
    code = "billing_not_configured" as const;

    constructor() {
        super("Billing is not configured on this server.");
        this.name = "BillingNotConfiguredError";
    }
}

export function billingErrorPayload(err: unknown) {
    if (err instanceof InsufficientTokensError) {
        return {
            code: err.code,
            detail: err.message,
            plan: err.plan,
            available: err.available,
        };
    }
    if (err instanceof PastDueError || err instanceof BillingNotConfiguredError) {
        return { code: err.code, detail: err.message };
    }
    return null;
}
