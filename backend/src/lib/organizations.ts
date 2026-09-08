import crypto from "crypto";
import { createServerSupabase } from "./supabase";
import { findProfileUserByEmail, normalizeEmail } from "./userLookup";
import {
    type BudgetEnforcement,
    type OrgInviteRole,
    type OrgRole,
    canChangeMemberRole,
    canDeleteOrganization,
    canManageOrgKeys,
    canManageOrgMembers,
    canManageOrgSettings,
    canRemoveMember,
    canTransferOwnership,
    isBudgetEnforcement,
    isOrgInviteRole,
    isOrgRole,
} from "./organizationRoles";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "./organizationSlug";

type Db = ReturnType<typeof createServerSupabase>;

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    created_by: string | null;
    admins_can_access_all_projects: boolean;
    monthly_budget_usd: number | string | null;
    budget_enforcement: BudgetEnforcement;
    created_at: string;
    updated_at: string;
};

export type OrganizationMemberRow = {
    id: string;
    organization_id: string;
    user_id: string;
    role: OrgRole;
    created_at: string;
    updated_at: string;
    email?: string | null;
    display_name?: string | null;
};

export type OrganizationInviteRow = {
    id: string;
    organization_id: string;
    email: string;
    role: OrgInviteRole;
    status: "pending" | "accepted" | "revoked" | "expired";
    expires_at: string;
    invited_by: string | null;
    accepted_at: string | null;
    created_at: string;
    organization_name?: string;
};

export type Membership = {
    organization: OrganizationRow;
    role: OrgRole;
};

function hashInviteToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function newInviteToken() {
    const token = crypto.randomBytes(32).toString("base64url");
    return { token, tokenHash: hashInviteToken(token) };
}

function inviteIsExpired(invite: { status: string; expires_at: string }) {
    return (
        invite.status === "pending" &&
        new Date(invite.expires_at).getTime() <= Date.now()
    );
}

function serializeOrg(row: OrganizationRow) {
    return {
        ...row,
        monthly_budget_usd:
            row.monthly_budget_usd == null
                ? null
                : Number(row.monthly_budget_usd),
    };
}

export async function getMembership(
    db: Db,
    organizationId: string,
    userId: string,
): Promise<Membership | null> {
    const [{ data: organization }, { data: member }] = await Promise.all([
        db.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
        db
            .from("organization_members")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("user_id", userId)
            .maybeSingle(),
    ]);
    if (!organization || !member) return null;
    if (!isOrgRole(member.role)) return null;
    return {
        organization: organization as OrganizationRow,
        role: member.role,
    };
}

export async function listUserOrganizations(
    db: Db,
    userId: string,
): Promise<Array<OrganizationRow & { role: OrgRole }>> {
    const { data, error } = await db
        .from("organization_members")
        .select("role, organizations(*)")
        .eq("user_id", userId);
    if (error) throw error;

    const result: Array<OrganizationRow & { role: OrgRole }> = [];
    for (const row of data ?? []) {
        const org = (row as { organizations?: OrganizationRow | OrganizationRow[] | null })
            .organizations;
        const organization = Array.isArray(org) ? org[0] : org;
        if (!organization || !isOrgRole(row.role)) continue;
        result.push({ ...serializeOrg(organization), role: row.role });
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
}

async function allocateSlug(db: Db, name: string) {
    const base = slugifyOrganizationName(name);
    const { data, error } = await db
        .from("organizations")
        .select("slug")
        .like("slug", `${base}%`);
    if (error) throw error;
    const existing = new Set((data ?? []).map((row) => String(row.slug)));
    return uniqueOrganizationSlug(base, existing);
}

export async function createOrganization(
    db: Db,
    args: { userId: string; name: string },
) {
    const name = args.name.trim();
    if (!name) throw new Error("name is required");
    const slug = await allocateSlug(db, name);
    const now = new Date().toISOString();
    const { data: organization, error } = await db
        .from("organizations")
        .insert({
            name,
            slug,
            created_by: args.userId,
            updated_at: now,
        })
        .select("*")
        .single();
    if (error) throw error;

    const { error: memberError } = await db.from("organization_members").insert({
        organization_id: organization.id,
        user_id: args.userId,
        role: "owner",
        updated_at: now,
    });
    if (memberError) throw memberError;

    await setActiveOrganization(db, args.userId, organization.id);
    return {
        ...serializeOrg(organization as OrganizationRow),
        role: "owner" as const,
    };
}

export async function updateOrganization(
    db: Db,
    organizationId: string,
    patch: {
        name?: string;
        admins_can_access_all_projects?: boolean;
        monthly_budget_usd?: number | null;
        budget_enforcement?: BudgetEnforcement;
    },
) {
    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (!name) throw new Error("name is required");
        updates.name = name;
    }
    if (patch.admins_can_access_all_projects !== undefined) {
        updates.admins_can_access_all_projects =
            patch.admins_can_access_all_projects;
    }
    if (patch.monthly_budget_usd !== undefined) {
        updates.monthly_budget_usd = patch.monthly_budget_usd;
    }
    if (patch.budget_enforcement !== undefined) {
        if (!isBudgetEnforcement(patch.budget_enforcement)) {
            throw new Error("Invalid budget enforcement");
        }
        updates.budget_enforcement = patch.budget_enforcement;
    }
    const { data, error } = await db
        .from("organizations")
        .update(updates)
        .eq("id", organizationId)
        .select("*")
        .single();
    if (error) throw error;
    return serializeOrg(data as OrganizationRow);
}

export async function deleteOrganization(db: Db, organizationId: string) {
    const { count, error: countError } = await db
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
        const err = new Error(
            "Move or delete this organization's projects before deleting the organization.",
        );
        (err as { code?: string }).code = "org_has_projects";
        throw err;
    }
    const { error } = await db
        .from("organizations")
        .delete()
        .eq("id", organizationId);
    if (error) throw error;
}

export async function setActiveOrganization(
    db: Db,
    userId: string,
    organizationId: string | null,
) {
    if (organizationId) {
        const membership = await getMembership(db, organizationId, userId);
        if (!membership) {
            const err = new Error("You are not a member of this organization.");
            (err as { code?: string }).code = "not_a_member";
            throw err;
        }
    }
    const { error } = await db
        .from("user_profiles")
        .update({
            active_organization_id: organizationId,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    if (error) throw error;
    return organizationId;
}

export async function getActiveOrganizationId(db: Db, userId: string) {
    const { data, error } = await db
        .from("user_profiles")
        .select("active_organization_id")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw error;
    return (data?.active_organization_id as string | null) ?? null;
}

export async function listOrganizationMembers(db: Db, organizationId: string) {
    const { data: members, error } = await db
        .from("organization_members")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });
    if (error) throw error;
    const userIds = (members ?? []).map((row) => row.user_id as string);
    const { data: profiles, error: profileError } = userIds.length
        ? await db
              .from("user_profiles")
              .select("user_id, email, display_name")
              .in("user_id", userIds)
        : { data: [], error: null };
    if (profileError) throw profileError;
    const profileById = new Map(
        (profiles ?? []).map((row) => [row.user_id as string, row]),
    );
    return (members ?? []).map((row) => {
        const profile = profileById.get(row.user_id as string);
        return {
            ...(row as OrganizationMemberRow),
            email: (profile?.email as string | null) ?? null,
            display_name: (profile?.display_name as string | null) ?? null,
        };
    });
}

export async function changeMemberRole(
    db: Db,
    args: {
        organizationId: string;
        actorUserId: string;
        actorRole: OrgRole;
        targetUserId: string;
        nextRole: OrgRole;
    },
) {
    if (args.actorUserId === args.targetUserId) {
        throw new Error("You cannot change your own role.");
    }
    const { data: target, error } = await db
        .from("organization_members")
        .select("*")
        .eq("organization_id", args.organizationId)
        .eq("user_id", args.targetUserId)
        .maybeSingle();
    if (error) throw error;
    if (!target || !isOrgRole(target.role)) {
        throw new Error("Member not found.");
    }
    const allowed = canChangeMemberRole({
        actorRole: args.actorRole,
        targetRole: target.role,
        nextRole: args.nextRole,
    });
    if (!allowed.ok) throw new Error(allowed.detail);
    const { data, error: updateError } = await db
        .from("organization_members")
        .update({
            role: args.nextRole,
            updated_at: new Date().toISOString(),
        })
        .eq("id", target.id)
        .select("*")
        .single();
    if (updateError) throw updateError;
    return data;
}

export async function removeOrganizationMember(
    db: Db,
    args: {
        organizationId: string;
        actorUserId: string;
        actorRole: OrgRole;
        targetUserId: string;
    },
) {
    const { data: target, error } = await db
        .from("organization_members")
        .select("*")
        .eq("organization_id", args.organizationId)
        .eq("user_id", args.targetUserId)
        .maybeSingle();
    if (error) throw error;
    if (!target || !isOrgRole(target.role)) {
        throw new Error("Member not found.");
    }
    const allowed = canRemoveMember({
        actorRole: args.actorRole,
        targetRole: target.role,
        actorUserId: args.actorUserId,
        targetUserId: args.targetUserId,
    });
    if (!allowed.ok) throw new Error(allowed.detail);
    const { error: deleteError } = await db
        .from("organization_members")
        .delete()
        .eq("id", target.id);
    if (deleteError) throw deleteError;

    const { data: profile } = await db
        .from("user_profiles")
        .select("active_organization_id")
        .eq("user_id", args.targetUserId)
        .maybeSingle();
    if (profile?.active_organization_id === args.organizationId) {
        await setActiveOrganization(db, args.targetUserId, null);
    }
}

export async function transferOrganizationOwnership(
    db: Db,
    args: {
        organizationId: string;
        actorUserId: string;
        actorRole: OrgRole;
        targetUserId: string;
    },
) {
    if (!canTransferOwnership(args.actorRole)) {
        throw new Error("Only the owner can transfer ownership.");
    }
    if (args.actorUserId === args.targetUserId) {
        throw new Error("You already own this organization.");
    }
    const { data: target, error } = await db
        .from("organization_members")
        .select("*")
        .eq("organization_id", args.organizationId)
        .eq("user_id", args.targetUserId)
        .maybeSingle();
    if (error) throw error;
    if (!target) throw new Error("Member not found.");

    const now = new Date().toISOString();
    const { error: targetError } = await db
        .from("organization_members")
        .update({ role: "owner", updated_at: now })
        .eq("id", target.id);
    if (targetError) throw targetError;
    const { error: actorError } = await db
        .from("organization_members")
        .update({ role: "admin", updated_at: now })
        .eq("organization_id", args.organizationId)
        .eq("user_id", args.actorUserId);
    if (actorError) throw actorError;
}

export async function createOrganizationInvite(
    db: Db,
    args: {
        organizationId: string;
        email: string;
        role: OrgInviteRole;
        invitedBy: string;
    },
) {
    if (!isOrgInviteRole(args.role)) {
        throw new Error("Invites can only assign admin or member.");
    }
    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) {
        throw new Error("A valid email is required.");
    }
    const existingUser = await findProfileUserByEmail(db, email);
    if (existingUser) {
        const membership = await getMembership(
            db,
            args.organizationId,
            existingUser.id,
        );
        if (membership) {
            throw new Error("That user is already a member of this organization.");
        }
    }

    const { data: existingInvite } = await db
        .from("organization_invites")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();
    if (existingInvite) {
        await db
            .from("organization_invites")
            .update({ status: "revoked" })
            .eq("id", existingInvite.id);
    }

    const { token, tokenHash } = newInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const { data, error } = await db
        .from("organization_invites")
        .insert({
            organization_id: args.organizationId,
            email,
            role: args.role,
            token_hash: tokenHash,
            invited_by: args.invitedBy,
            expires_at: expiresAt,
        })
        .select("*")
        .single();
    if (error) throw error;
    return { invite: data as OrganizationInviteRow, token };
}

export async function listOrganizationInvites(db: Db, organizationId: string) {
    const { data, error } = await db
        .from("organization_invites")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    if (error) throw error;
    const invites = [];
    for (const row of (data ?? []) as OrganizationInviteRow[]) {
        if (inviteIsExpired(row)) {
            await db
                .from("organization_invites")
                .update({ status: "expired" })
                .eq("id", row.id);
            continue;
        }
        invites.push(row);
    }
    return invites;
}

export async function revokeOrganizationInvite(
    db: Db,
    organizationId: string,
    inviteId: string,
) {
    const { data, error } = await db
        .from("organization_invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Invite not found.");
}

export async function getInviteByToken(db: Db, token: string) {
    const tokenHash = hashInviteToken(token);
    const { data, error } = await db
        .from("organization_invites")
        .select("*, organizations(name, slug)")
        .eq("token_hash", tokenHash)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const invite = data as OrganizationInviteRow & {
        organizations?: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
    };
    const org = Array.isArray(invite.organizations)
        ? invite.organizations[0]
        : invite.organizations;
    if (inviteIsExpired(invite)) {
        await db
            .from("organization_invites")
            .update({ status: "expired" })
            .eq("id", invite.id);
        return {
            ...invite,
            status: "expired" as const,
            organization_name: org?.name,
        };
    }
    return { ...invite, organization_name: org?.name };
}

export async function listPendingInvitesForEmail(db: Db, email: string) {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];
    const { data, error } = await db
        .from("organization_invites")
        .select("*, organizations(name)")
        .eq("email", normalized)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    if (error) throw error;
    const invites: OrganizationInviteRow[] = [];
    for (const row of data ?? []) {
        const invite = row as OrganizationInviteRow & {
            organizations?: { name?: string } | { name?: string }[] | null;
        };
        if (inviteIsExpired(invite)) {
            await db
                .from("organization_invites")
                .update({ status: "expired" })
                .eq("id", invite.id);
            continue;
        }
        const org = Array.isArray(invite.organizations)
            ? invite.organizations[0]
            : invite.organizations;
        invites.push({ ...invite, organization_name: org?.name });
    }
    return invites;
}

export async function acceptOrganizationInvite(
    db: Db,
    args: { token: string; userId: string; userEmail: string },
) {
    const invite = await getInviteByToken(db, args.token);
    if (!invite) throw new Error("Invite not found.");
    if (invite.status !== "pending") {
        throw new Error("This invite is no longer valid.");
    }
    const email = normalizeEmail(args.userEmail);
    if (email !== invite.email) {
        throw new Error("This invite was sent to a different email address.");
    }
    const existing = await getMembership(db, invite.organization_id, args.userId);
    if (!existing) {
        const { error } = await db.from("organization_members").insert({
            organization_id: invite.organization_id,
            user_id: args.userId,
            role: invite.role,
            updated_at: new Date().toISOString(),
        });
        if (error) throw error;
    }
    const { error: acceptError } = await db
        .from("organization_invites")
        .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id);
    if (acceptError) throw acceptError;
    await setActiveOrganization(db, args.userId, invite.organization_id);
    const membership = await getMembership(db, invite.organization_id, args.userId);
    if (!membership) throw new Error("Failed to join organization.");
    return membership;
}

export {
    canDeleteOrganization,
    canManageOrgKeys,
    canManageOrgMembers,
    canManageOrgSettings,
};
