import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceAccent, workspaceInitials } from "./workspaceAppearance";

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
});
