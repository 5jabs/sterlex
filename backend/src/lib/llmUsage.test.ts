import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentUtcMonthRange, estimateLlmCostUsd } from "./llmUsage";

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
});
