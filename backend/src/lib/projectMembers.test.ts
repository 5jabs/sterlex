import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCanAddProjectMember } from "./projectMembers";

describe("project members", () => {
    it("rejects adding the project owner", () => {
        const result = assertCanAddProjectMember({
            projectOwnerId: "owner-1",
            projectOrganizationId: null,
            targetUserId: "owner-1",
            targetIsOrgMember: true,
        });
        assert.equal(result.ok, false);
    });

    it("rejects a non-org user on an organization project", () => {
        const result = assertCanAddProjectMember({
            projectOwnerId: "owner-1",
            projectOrganizationId: "org-1",
            targetUserId: "user-2",
            targetIsOrgMember: false,
        });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.detail, /organization members/i);
        }
    });

    it("allows an org colleague on an organization project", () => {
        const result = assertCanAddProjectMember({
            projectOwnerId: "owner-1",
            projectOrganizationId: "org-1",
            targetUserId: "user-2",
            targetIsOrgMember: true,
        });
        assert.equal(result.ok, true);
    });

    it("allows any Sterlex user on a personal project", () => {
        const result = assertCanAddProjectMember({
            projectOwnerId: "owner-1",
            projectOrganizationId: null,
            targetUserId: "user-2",
            targetIsOrgMember: false,
        });
        assert.equal(result.ok, true);
    });
});
