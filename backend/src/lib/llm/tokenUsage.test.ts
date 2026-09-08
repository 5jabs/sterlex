import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    addTokenUsage,
    tokenUsageFromClaude,
    tokenUsageFromGemini,
    tokenUsageFromOpenAI,
} from "./tokenUsage";
import {
    budgetAction,
    isOverBudget,
} from "../llmUsage";

describe("token usage extractors", () => {
    it("reads Claude message usage", () => {
        assert.deepEqual(
            tokenUsageFromClaude({
                usage: { input_tokens: 120, output_tokens: 40 },
            }),
            { inputTokens: 120, outputTokens: 40 },
        );
    });

    it("reads OpenAI Responses usage from the completed event", () => {
        assert.deepEqual(
            tokenUsageFromOpenAI({
                type: "response.completed",
                response: { usage: { input_tokens: 80, output_tokens: 20 } },
            }),
            { inputTokens: 80, outputTokens: 20 },
        );
    });

    it("reads OpenAI usage from a non-stream response body", () => {
        assert.deepEqual(
            tokenUsageFromOpenAI({
                usage: { input_tokens: 11, output_tokens: 7 },
            }),
            { inputTokens: 11, outputTokens: 7 },
        );
    });

    it("reads Gemini usageMetadata, including thinking tokens as output", () => {
        assert.deepEqual(
            tokenUsageFromGemini({
                usageMetadata: {
                    promptTokenCount: 50,
                    candidatesTokenCount: 10,
                    thoughtsTokenCount: 5,
                },
            }),
            { inputTokens: 50, outputTokens: 15 },
        );
    });

    it("sums usage across tool-loop iterations", () => {
        assert.deepEqual(
            addTokenUsage(
                { inputTokens: 10, outputTokens: 2 },
                { inputTokens: 4, outputTokens: 8 },
            ),
            { inputTokens: 14, outputTokens: 10 },
        );
    });
});

describe("budget enforcement", () => {
    it("treats a missing cap as not over budget", () => {
        assert.equal(isOverBudget(12.5, null), false);
        assert.equal(isOverBudget(12.5, 12.5), true);
        assert.equal(isOverBudget(12.49, 12.5), false);
    });

    it("blocks only on hard enforcement when over budget", () => {
        assert.equal(budgetAction("off", true), "allow");
        assert.equal(budgetAction("soft", true), "warn");
        assert.equal(budgetAction("hard", true), "block");
        assert.equal(budgetAction("hard", false), "allow");
    });
});
