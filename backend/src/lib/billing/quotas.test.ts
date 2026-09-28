import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    billedTokensForUsage,
    canCollaborate,
    canPurchaseTokens,
    includedTokensFor,
} from "./quotas";

describe("billing quotas", () => {
    it("grants placeholder included tokens", () => {
        assert.equal(includedTokensFor("free"), 50_000);
        assert.equal(includedTokensFor("personal"), 2_000_000);
        assert.equal(includedTokensFor("enterprise", 3), 6_000_000);
    });

    it("bills at least one token and applies model multipliers", () => {
        assert.equal(
            billedTokensForUsage({
                model: "gemini-3-flash-preview",
                inputTokens: 100,
                outputTokens: 50,
            }),
            150,
        );
        assert.equal(
            billedTokensForUsage({
                model: "claude-opus-4-8",
                inputTokens: 100,
                outputTokens: 0,
            }),
            400,
        );
        assert.equal(
            billedTokensForUsage({ model: "unknown", inputTokens: 0, outputTokens: 0 }),
            0,
        );
    });

    it("only paid plans buy packs or share workspaces", () => {
        assert.equal(canPurchaseTokens("free"), false);
        assert.equal(canPurchaseTokens("personal"), true);
        assert.equal(canCollaborate("personal"), false);
        assert.equal(canCollaborate("enterprise"), true);
    });
});
