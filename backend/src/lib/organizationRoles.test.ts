import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    canChangeMemberRole,
    canRemoveMember,
    isOrgAdmin,
    isOrgInviteRole,
} from "./organizationRoles";

describe("organization roles", () => {
    it("treats owner and admin as org admins", () => {
        assert.equal(isOrgAdmin("owner"), true);
        assert.equal(isOrgAdmin("admin"), true);
        assert.equal(isOrgAdmin("member"), false);
    });

    it("does not allow inviting an owner", () => {
        assert.equal(isOrgInviteRole("owner"), false);
        assert.equal(isOrgInviteRole("admin"), true);
        assert.equal(isOrgInviteRole("member"), true);
    });

    it("prevents changing the owner role except via transfer", () => {
        const result = canChangeMemberRole({
            actorRole: "owner",
            targetRole: "owner",
            nextRole: "admin",
        });
        assert.equal(result.ok, false);
    });

    it("lets the owner promote a member to admin", () => {
        const result = canChangeMemberRole({
            actorRole: "owner",
            targetRole: "member",
            nextRole: "admin",
        });
        assert.equal(result.ok, true);
    });

    it("does not let an admin promote to admin", () => {
        const result = canChangeMemberRole({
            actorRole: "admin",
            targetRole: "member",
            nextRole: "admin",
        });
        assert.equal(result.ok, false);
    });

    it("requires ownership transfer before the owner leaves", () => {
        const result = canRemoveMember({
            actorRole: "owner",
            targetRole: "owner",
            actorUserId: "a",
            targetUserId: "a",
        });
        assert.equal(result.ok, false);
    });

    it("lets a member leave", () => {
        const result = canRemoveMember({
            actorRole: "member",
            targetRole: "member",
            actorUserId: "a",
            targetUserId: "a",
        });
        assert.equal(result.ok, true);
    });
});
