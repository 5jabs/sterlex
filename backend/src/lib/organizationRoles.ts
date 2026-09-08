export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ORG_INVITE_ROLES = ["admin", "member"] as const;
export type OrgInviteRole = (typeof ORG_INVITE_ROLES)[number];
export const BUDGET_ENFORCEMENT = ["off", "soft", "hard"] as const;
export type BudgetEnforcement = (typeof BUDGET_ENFORCEMENT)[number];

export function isOrgRole(value: unknown): value is OrgRole {
    return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}

export function isOrgInviteRole(value: unknown): value is OrgInviteRole {
    return (
        typeof value === "string" &&
        (ORG_INVITE_ROLES as readonly string[]).includes(value)
    );
}

export function isBudgetEnforcement(value: unknown): value is BudgetEnforcement {
    return (
        typeof value === "string" &&
        (BUDGET_ENFORCEMENT as readonly string[]).includes(value)
    );
}

export function isOrgAdmin(role: OrgRole | null | undefined): boolean {
    return role === "owner" || role === "admin";
}

export function canManageOrgSettings(role: OrgRole | null | undefined): boolean {
    return isOrgAdmin(role);
}

export function canManageOrgMembers(role: OrgRole | null | undefined): boolean {
    return isOrgAdmin(role);
}

export function canManageOrgKeys(role: OrgRole | null | undefined): boolean {
    return isOrgAdmin(role);
}

export function canDeleteOrganization(role: OrgRole | null | undefined): boolean {
    return role === "owner";
}

export function canTransferOwnership(role: OrgRole | null | undefined): boolean {
    return role === "owner";
}

export function canChangeMemberRole(args: {
    actorRole: OrgRole;
    targetRole: OrgRole;
    nextRole: OrgRole;
}): { ok: true } | { ok: false; detail: string } {
    const { actorRole, targetRole, nextRole } = args;
    if (targetRole === "owner") {
        return { ok: false, detail: "Transfer ownership instead of changing the owner role." };
    }
    if (nextRole === "owner") {
        return { ok: false, detail: "Transfer ownership instead of assigning the owner role." };
    }
    if (!canManageOrgMembers(actorRole)) {
        return { ok: false, detail: "Only owners and admins can change roles." };
    }
    if (actorRole !== "owner" && targetRole === "admin") {
        return { ok: false, detail: "Only the owner can change an admin's role." };
    }
    if (actorRole !== "owner" && nextRole === "admin") {
        return { ok: false, detail: "Only the owner can promote a member to admin." };
    }
    return { ok: true };
}

export function canRemoveMember(args: {
    actorRole: OrgRole;
    targetRole: OrgRole;
    actorUserId: string;
    targetUserId: string;
}): { ok: true } | { ok: false; detail: string } {
    const { actorRole, targetRole, actorUserId, targetUserId } = args;
    if (actorUserId === targetUserId) {
        if (actorRole === "owner") {
            return {
                ok: false,
                detail: "Transfer ownership before leaving the organization.",
            };
        }
        return { ok: true };
    }
    if (targetRole === "owner") {
        return { ok: false, detail: "The organization owner cannot be removed." };
    }
    if (!canManageOrgMembers(actorRole)) {
        return { ok: false, detail: "Only owners and admins can remove members." };
    }
    if (actorRole !== "owner" && targetRole === "admin") {
        return { ok: false, detail: "Only the owner can remove an admin." };
    }
    return { ok: true };
}
