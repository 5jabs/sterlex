import type {
    OrganizationActivityAction,
    OrganizationActivityEvent,
} from "@/app/lib/sterlexApi";

function personName(event: OrganizationActivityEvent, who: "actor" | "target") {
    if (who === "actor") {
        return event.actor_display_name || event.actor_email || "Someone";
    }
    return (
        event.target_display_name || event.target_email || "a colleague"
    );
}

function metadataString(event: OrganizationActivityEvent, key: string) {
    const value = event.metadata?.[key];
    return typeof value === "string" ? value : null;
}

export function organizationActivityLabel(
    event: OrganizationActivityEvent,
): string {
    const actor = personName(event, "actor");
    const target = personName(event, "target");
    const project = event.project_name || "a project";
    const action: OrganizationActivityAction = event.action;

    switch (action) {
        case "organization_created":
            return `${actor} created this organization`;
        case "settings_updated":
            return `${actor} updated organization settings`;
        case "member_joined":
            return `${target} joined the organization`;
        case "member_removed":
            return `${actor} removed ${target}`;
        case "member_role_changed": {
            const from = metadataString(event, "from");
            const to = metadataString(event, "to");
            return from && to
                ? `${actor} changed ${target} from ${from} to ${to}`
                : `${actor} changed ${target}'s role`;
        }
        case "ownership_transferred":
            return `${actor} transferred ownership to ${target}`;
        case "invite_created":
            return `${actor} invited ${event.target_email || "a colleague"}`;
        case "invite_accepted":
            return `${target} accepted an invite`;
        case "invite_revoked":
            return `${actor} revoked the invite for ${event.target_email || "a colleague"}`;
        case "invite_link_regenerated":
            return `${actor} generated a new invite link for ${event.target_email || "a colleague"}`;
        case "project_member_added":
            return `${actor} added ${target} to ${project}`;
        case "project_member_removed":
            return `${actor} removed ${target} from ${project}`;
        case "api_key_saved":
            return `${actor} saved a ${metadataString(event, "provider") || "provider"} API key`;
        case "api_key_removed":
            return `${actor} removed a ${metadataString(event, "provider") || "provider"} API key`;
        default:
            return `${actor} updated the organization`;
    }
}

export function formatActivityWhen(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}
