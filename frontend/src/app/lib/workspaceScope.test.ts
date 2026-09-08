import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    belongsToWorkspace,
    filterByWorkspace,
    stepPickerIndex,
} from "./workspaceScope";

describe("workspace scope", () => {
    const ids = new Set(["matter-1", "matter-2"]);

    it("keeps standalone items in personal and hides them in an organization", () => {
        assert.equal(belongsToWorkspace(null, true, ids), true);
        assert.equal(belongsToWorkspace(undefined, true, ids), true);
        assert.equal(belongsToWorkspace(null, false, ids), false);
    });

    it("keeps project items only when they belong to the sitting", () => {
        assert.equal(belongsToWorkspace("matter-1", false, ids), true);
        assert.equal(belongsToWorkspace("other", false, ids), false);
        assert.equal(belongsToWorkspace("other", true, ids), false);
    });

    it("filters mixed lists to the current workspace", () => {
        const items = [
            { id: "a", project_id: null },
            { id: "b", project_id: "matter-1" },
            { id: "c", project_id: "other" },
        ];
        assert.deepEqual(
            filterByWorkspace(items, true, ids).map((item) => item.id),
            ["a", "b"],
        );
        assert.deepEqual(
            filterByWorkspace(items, false, ids).map((item) => item.id),
            ["b"],
        );
    });

    it("wraps picker keyboard focus", () => {
        assert.equal(stepPickerIndex(0, -1, 3), 2);
        assert.equal(stepPickerIndex(2, 1, 3), 0);
        assert.equal(stepPickerIndex(1, 1, 3), 2);
        assert.equal(stepPickerIndex(0, 1, 0), 0);
    });
});
