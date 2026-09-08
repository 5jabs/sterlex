import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveApiKeys } from "./apiKeyResolution";

describe("API key resolution", () => {
    it("uses env then personal keys in the personal workspace", () => {
        const resolved = resolveApiKeys({
            context: "personal",
            envKeys: { openai: "env-openai" },
            userKeys: { openai: "user-openai", claude: "user-claude" },
        });
        assert.equal(resolved.keys.openai, "env-openai");
        assert.equal(resolved.sources.openai, "env");
        assert.equal(resolved.keys.claude, "user-claude");
        assert.equal(resolved.sources.claude, "user");
    });

    it("uses organization keys and does not fall back to personal keys", () => {
        const resolved = resolveApiKeys({
            context: "organization",
            envKeys: { openai: "env-openai" },
            userKeys: { claude: "user-claude" },
            orgKeys: { gemini: "org-gemini" },
        });
        assert.equal(resolved.keys.gemini, "org-gemini");
        assert.equal(resolved.sources.gemini, "org");
        assert.equal(resolved.keys.claude ?? null, null);
        assert.equal(resolved.keys.openai ?? null, null);
    });

    it("optionally uses env keys in an organization", () => {
        const resolved = resolveApiKeys({
            context: "organization",
            envKeys: { openai: "env-openai" },
            orgKeys: {},
            allowEnvInOrganization: true,
        });
        assert.equal(resolved.keys.openai, "env-openai");
        assert.equal(resolved.sources.openai, "env");
    });
});
