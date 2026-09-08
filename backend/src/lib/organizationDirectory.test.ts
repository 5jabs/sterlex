import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeProjectAccess } from "./organizationDirectory";
import { canManageProjectRoster } from "./projectMembers";

describe("organization directory access", () => {
    it("treats the project owner as owner access", () => {
        assert.equal(
            describeProjectAccess({
                projectOwnerId: "owner",
                userId: "owner",
                isExplicitMember: false,
                orgAdminsCanAccessAll: true,
                orgRole: "owner",
            }),
            "owner",
        );
    });

    it("prefers explicit membership over admin-all", () => {
        assert.equal(
            describeProjectAccess({
                projectOwnerId: "owner",
                userId: "admin-1",
                isExplicitMember: true,
                orgAdminsCanAccessAll: true,
                orgRole: "admin",
            }),
            "member",
        );
    });

    it("exposes org-admin-all only when the flag is on", () => {
        assert.equal(
            describeProjectAccess({
                projectOwnerId: "owner",
                userId: "admin-1",
                isExplicitMember: false,
                orgAdminsCanAccessAll: true,
                orgRole: "admin",
            }),
            "org_admin_all",
        );
        assert.equal(
            describeProjectAccess({
                projectOwnerId: "owner",
                userId: "admin-1",
                isExplicitMember: false,
                orgAdminsCanAccessAll: false,
                orgRole: "admin",
            }),
            "none",
        );
    });

    it("does not treat regular members as having admin-all access", () => {
        assert.equal(
            describeProjectAccess({
                projectOwnerId: "owner",
                userId: "member-1",
                isExplicitMember: false,
                orgAdminsCanAccessAll: true,
                orgRole: "member",
            }),
            "none",
        );
    });
});

describe("project roster management", () => {
    it("lets the project owner manage the roster", () => {
        assert.equal(
            canManageProjectRoster({
                actorUserId: "owner",
                projectOwnerId: "owner",
                actorOrgRole: "member",
            }),
            true,
        );
    });

    it("lets an org admin manage the roster", () => {
        assert.equal(
            canManageProjectRoster({
                actorUserId: "admin",
                projectOwnerId: "owner",
                actorOrgRole: "admin",
            }),
            true,
        );
    });

    it("does not let a regular org member manage someone else's project", () => {
        assert.equal(
            canManageProjectRoster({
                actorUserId: "member",
                projectOwnerId: "owner",
                actorOrgRole: "member",
            }),
            false,
        );
    });
});
