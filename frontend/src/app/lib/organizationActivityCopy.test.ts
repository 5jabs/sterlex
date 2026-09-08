import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { organizationActivityLabel } from "./organizationActivityCopy";
import type { OrganizationActivityEvent } from "./sterlexApi";

function event(
    action: OrganizationActivityEvent["action"],
    extra: Partial<OrganizationActivityEvent> = {},
): OrganizationActivityEvent {
    return {
        id: "1",
        organization_id: "org",
        actor_user_id: "a",
        action,
        target_user_id: "b",
        target_email: "b@firm.com",
        project_id: extra.project_id ?? null,
        metadata: extra.metadata ?? {},
        created_at: new Date().toISOString(),
        actor_display_name: "Ana",
        actor_email: "ana@firm.com",
        target_display_name: "Bia",
        project_name: extra.project_name ?? null,
        ...extra,
    };
}

describe("organization activity copy", () => {
    it("describes an invite without claiming email was sent", () => {
        const label = organizationActivityLabel(event("invite_created"));
        assert.match(label, /invited b@firm.com/i);
        assert.doesNotMatch(label, /email/i);
    });

    it("includes the project name for access changes", () => {
        const label = organizationActivityLabel(
            event("project_member_added", { project_name: "Smith v Jones" }),
        );
        assert.match(label, /Smith v Jones/);
        assert.match(label, /added Bia/);
    });
});
