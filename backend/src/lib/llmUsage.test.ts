import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    currentUtcMonthRange,
    estimateLlmCostUsd,
    meteringFromSettings,
    withBudgetFields,
} from "./llmUsage";

describe("LLM usage estimates", () => {
    it("estimates cost from token counts", () => {
        const cost = estimateLlmCostUsd({
            model: "gpt-5.4-mini",
            inputTokens: 1_000_000,
            outputTokens: 1_000_000,
        });
        assert.equal(cost, 2);
    });

    it("returns the UTC month window", () => {
        const range = currentUtcMonthRange(
            new Date("2026-09-08T13:00:00.000Z"),
        );
        assert.equal(range.start, "2026-09-01T00:00:00.000Z");
        assert.equal(range.end, "2026-10-01T00:00:00.000Z");
    });

    it("adds remaining and over-budget fields", () => {
        const view = withBudgetFields(
            {
                periodStart: "2026-09-01T00:00:00.000Z",
                periodEnd: "2026-10-01T00:00:00.000Z",
                eventCount: 2,
                inputTokens: 10,
                outputTokens: 4,
                estimatedCostUsd: 12.5,
                byProvider: {},
            },
            10,
            "hard",
        );
        assert.equal(view.overBudget, true);
        assert.equal(view.remainingUsd, 0);
        assert.equal(view.budgetEnforcement, "hard");
        assert.equal(view.monthlyBudgetUsd, 10);
    });

    it("uses the provider key source from settings", () => {
        const metering = meteringFromSettings({
            db: {} as never,
            userId: "user-1",
            organizationId: "org-1",
            projectId: "proj-1",
            model: "gpt-5.4",
            apiKeySources: { openai: "org" },
        });
        assert.equal(metering.keySource, "org");
        assert.equal(metering.organizationId, "org-1");
        assert.equal(metering.projectId, "proj-1");
    });
});
