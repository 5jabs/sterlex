import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    PERSONAL_WORKSPACE_ID,
    clearWorkspaceSession,
    readWorkspaceSession,
    toWorkspaceSessionId,
    workspaceSessionMatchesOrg,
    writeWorkspaceSession,
} from "./workspaceSession";

function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
        getItem: (key: string) => (key in data ? data[key] : null),
        setItem: (key: string, value: string) => {
            data[key] = value;
        },
        removeItem: (key: string) => {
            delete data[key];
        },
    };
}

describe("workspace session", () => {
    it("stores personal as an explicit session, not a missing key", () => {
        const storage = memoryStorage();
        writeWorkspaceSession(PERSONAL_WORKSPACE_ID, storage);
        assert.equal(readWorkspaceSession(storage), PERSONAL_WORKSPACE_ID);
        assert.equal(
            workspaceSessionMatchesOrg(PERSONAL_WORKSPACE_ID, null),
            true,
        );
        assert.equal(
            workspaceSessionMatchesOrg(PERSONAL_WORKSPACE_ID, "org-1"),
            false,
        );
    });

    it("maps a null organization id to personal", () => {
        assert.equal(toWorkspaceSessionId(null), PERSONAL_WORKSPACE_ID);
        assert.equal(toWorkspaceSessionId("org-1"), "org-1");
    });

    it("clears the sitting so the picker shows again", () => {
        const storage = memoryStorage();
        writeWorkspaceSession("org-1", storage);
        clearWorkspaceSession(storage);
        assert.equal(readWorkspaceSession(storage), null);
    });
});
