import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { personalWorkspaceName, workspaceAccent, workspaceInitials } from "./workspaceAppearance";

describe("workspace appearance", () => {
    it("uses two letters from a multi-word name", () => {
        assert.equal(workspaceInitials("Baker McKenzie"), "BM");
    });

    it("uses the first two letters of a single word", () => {
        assert.equal(workspaceInitials("Sterlex"), "ST");
    });

    it("picks a stable accent for the same key", () => {
        assert.deepEqual(workspaceAccent("acme"), workspaceAccent("acme"));
    });

    it("uses the display name, then email local-part, for personal", () => {
        assert.equal(personalWorkspaceName("Ana Costa", "ana@firm.com"), "Ana Costa");
        assert.equal(personalWorkspaceName("  ", "ana@firm.com"), "ana");
        assert.equal(personalWorkspaceName(null, null), "Personal");
    });
});
