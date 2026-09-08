import type { createServerSupabase } from "./supabase";
import { getMembership } from "./organizations";
import {
    findProfileUserByEmail,
    findMissingUserEmails,
    loadProfileUsersByEmail,
    normalizeEmail,
} from "./userLookup";

type Db = ReturnType<typeof createServerSupabase>;

export type ProjectMemberRole = "member";

export type ProjectMemberRecord = {
    id: string;
    project_id: string;
    user_id: string;
    role: ProjectMemberRole;
    added_by: string | null;
    created_at: string;
    email: string | null;
    display_name: string | null;
};

export type ProjectAccessEvent = {
    id: string;
    project_id: string;
    actor_user_id: string | null;
    action: "member_added" | "member_removed";
    target_user_id: string | null;
    target_email: string | null;
    created_at: string;
    actor_display_name: string | null;
    actor_email: string | null;
    target_display_name: string | null;
};

export function assertCanAddProjectMember(args: {
    projectOwnerId: string;
    projectOrganizationId: string | null;
    targetUserId: string;
    targetIsOrgMember: boolean;
}): { ok: true } | { ok: false; detail: string } {
    if (args.targetUserId === args.projectOwnerId) {
        return { ok: false, detail: "The project owner already has access." };
    }
    if (args.projectOrganizationId && !args.targetIsOrgMember) {
        return {
            ok: false,
            detail: "Only organization members can be added to this project.",
        };
    }
    return { ok: true };
}

async function isOrganizationMember(
    db: Db,
    organizationId: string,
    userId: string,
) {
    const membership = await getMembership(db, organizationId, userId);
    return !!membership;
}

export async function listProjectMembers(
    db: Db,
    projectId: string,
): Promise<ProjectMemberRecord[]> {
    const { data, error } = await db
        .from("project_members")
        .select("id, project_id, user_id, role, added_by, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    const userIds = rows.map((row) => row.user_id as string);
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
    return rows.map((row) => {
        const profile = profileById.get(row.user_id as string);
        return {
            id: row.id as string,
            project_id: row.project_id as string,
            user_id: row.user_id as string,
            role: "member" as const,
            added_by: (row.added_by as string | null) ?? null,
            created_at: row.created_at as string,
            email: (profile?.email as string | null) ?? null,
            display_name: (profile?.display_name as string | null) ?? null,
        };
    });
}

export async function listProjectAccessEvents(
    db: Db,
    projectId: string,
    limit = 40,
): Promise<ProjectAccessEvent[]> {
    const { data, error } = await db
        .from("project_access_events")
        .select(
            "id, project_id, actor_user_id, action, target_user_id, target_email, created_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    const rows = data ?? [];
    const userIds = [
        ...new Set(
            rows.flatMap((row) =>
                [row.actor_user_id, row.target_user_id].filter(
                    (id): id is string => typeof id === "string" && !!id,
                ),
            ),
        ),
    ];
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
    return rows.map((row) => {
        const actor = row.actor_user_id
            ? profileById.get(row.actor_user_id as string)
            : null;
        const target = row.target_user_id
            ? profileById.get(row.target_user_id as string)
            : null;
        return {
            id: row.id as string,
            project_id: row.project_id as string,
            actor_user_id: (row.actor_user_id as string | null) ?? null,
            action: row.action as ProjectAccessEvent["action"],
            target_user_id: (row.target_user_id as string | null) ?? null,
            target_email: (row.target_email as string | null) ?? null,
            created_at: row.created_at as string,
            actor_display_name:
                (actor?.display_name as string | null) ?? null,
            actor_email: (actor?.email as string | null) ?? null,
            target_display_name:
                (target?.display_name as string | null) ?? null,
        };
    });
}

async function recordAccessEvent(
    db: Db,
    input: {
        projectId: string;
        actorUserId: string;
        action: ProjectAccessEvent["action"];
        targetUserId: string;
        targetEmail: string | null;
    },
) {
    const { error } = await db.from("project_access_events").insert({
        project_id: input.projectId,
        actor_user_id: input.actorUserId,
        action: input.action,
        target_user_id: input.targetUserId,
        target_email: input.targetEmail,
    });
    if (error) {
        console.error("[project-members] failed to record event", error.message);
    }
}

export async function syncSharedWithFromMembers(db: Db, projectId: string) {
    const members = await listProjectMembers(db, projectId);
    const emails = members
        .map((member) => normalizeEmail(member.email))
        .filter(Boolean);
    const { error } = await db
        .from("projects")
        .update({
            shared_with: emails,
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    if (error) throw error;
    return emails;
}

export async function addProjectMember(
    db: Db,
    args: {
        projectId: string;
        projectOwnerId: string;
        projectOrganizationId: string | null;
        actorUserId: string;
        targetUserId?: string | null;
        email?: string | null;
    },
): Promise<ProjectMemberRecord> {
    if (!args.targetUserId && !normalizeEmail(args.email)) {
        throw Object.assign(
            new Error("Provide a user or email to add."),
            { status: 400 },
        );
    }

    let target = args.targetUserId
        ? await db
              .from("user_profiles")
              .select("user_id, email, display_name")
              .eq("user_id", args.targetUserId)
              .maybeSingle()
              .then(({ data, error }) => {
                  if (error) throw error;
                  return data
                      ? {
                            id: data.user_id as string,
                            email: normalizeEmail(data.email),
                            display_name:
                                typeof data.display_name === "string"
                                    ? data.display_name
                                    : null,
                        }
                      : null;
              })
        : null;
    if (!target && args.email) {
        target = await findProfileUserByEmail(db, args.email);
    }
    if (!target) {
        throw Object.assign(new Error("That email does not belong to a Sterlex user."), {
            status: 400,
        });
    }

    const allowed = assertCanAddProjectMember({
        projectOwnerId: args.projectOwnerId,
        projectOrganizationId: args.projectOrganizationId,
        targetUserId: target.id,
        targetIsOrgMember: args.projectOrganizationId
            ? await isOrganizationMember(db, args.projectOrganizationId, target.id)
            : true,
    });
    if (!allowed.ok) {
        throw Object.assign(new Error(allowed.detail), { status: 400 });
    }

    const { data: existing, error: existingError } = await db
        .from("project_members")
        .select("id")
        .eq("project_id", args.projectId)
        .eq("user_id", target.id)
        .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
        throw Object.assign(new Error("This person already has access."), {
            status: 400,
        });
    }

    const { data, error } = await db
        .from("project_members")
        .insert({
            project_id: args.projectId,
            user_id: target.id,
            role: "member",
            added_by: args.actorUserId,
        })
        .select("id, project_id, user_id, role, added_by, created_at")
        .single();
    if (error || !data) throw error ?? new Error("Failed to add project member.");

    await syncSharedWithFromMembers(db, args.projectId);
    await recordAccessEvent(db, {
        projectId: args.projectId,
        actorUserId: args.actorUserId,
        action: "member_added",
        targetUserId: target.id,
        targetEmail: target.email || null,
    });

    return {
        id: data.id as string,
        project_id: data.project_id as string,
        user_id: data.user_id as string,
        role: "member",
        added_by: (data.added_by as string | null) ?? null,
        created_at: data.created_at as string,
        email: target.email || null,
        display_name: target.display_name,
    };
}

export async function removeProjectMember(
    db: Db,
    args: {
        projectId: string;
        projectOwnerId: string;
        actorUserId: string;
        targetUserId: string;
    },
) {
    if (args.targetUserId === args.projectOwnerId) {
        throw Object.assign(new Error("The project owner cannot be removed."), {
            status: 400,
        });
    }
    const { data: existing, error: existingError } = await db
        .from("project_members")
        .select("id, user_id")
        .eq("project_id", args.projectId)
        .eq("user_id", args.targetUserId)
        .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
        throw Object.assign(new Error("Member not found."), { status: 404 });
    }

    const { data: profile } = await db
        .from("user_profiles")
        .select("email")
        .eq("user_id", args.targetUserId)
        .maybeSingle();

    const { error } = await db
        .from("project_members")
        .delete()
        .eq("id", existing.id);
    if (error) throw error;

    await syncSharedWithFromMembers(db, args.projectId);
    await recordAccessEvent(db, {
        projectId: args.projectId,
        actorUserId: args.actorUserId,
        action: "member_removed",
        targetUserId: args.targetUserId,
        targetEmail: normalizeEmail(profile?.email) || null,
    });
}

export async function replaceProjectMembersByEmails(
    db: Db,
    args: {
        projectId: string;
        projectOwnerId: string;
        projectOrganizationId: string | null;
        actorUserId: string;
        emails: string[];
        actorEmail?: string | null;
    },
) {
    const normalizedUserEmail = normalizeEmail(args.actorEmail);
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of args.emails) {
        const email = normalizeEmail(raw);
        if (!email || seen.has(email)) continue;
        if (normalizedUserEmail && email === normalizedUserEmail) {
            throw Object.assign(
                new Error("You cannot share a project with yourself."),
                { status: 400 },
            );
        }
        seen.add(email);
        cleaned.push(email);
    }

    const missing = await findMissingUserEmails(db, cleaned);
    if (missing.length > 0) {
        throw Object.assign(
            new Error(`${missing[0]} does not belong to a Sterlex user.`),
            { status: 400 },
        );
    }

    const { userByEmail } = await loadProfileUsersByEmail(db);
    const desiredIds = new Set<string>();
    for (const email of cleaned) {
        const user = userByEmail.get(email);
        if (!user) continue;
        if (user.id === args.projectOwnerId) continue;
        const allowed = assertCanAddProjectMember({
            projectOwnerId: args.projectOwnerId,
            projectOrganizationId: args.projectOrganizationId,
            targetUserId: user.id,
            targetIsOrgMember: args.projectOrganizationId
                ? await isOrganizationMember(
                      db,
                      args.projectOrganizationId,
                      user.id,
                  )
                : true,
        });
        if (!allowed.ok) {
            throw Object.assign(new Error(allowed.detail), { status: 400 });
        }
        desiredIds.add(user.id);
    }

    const current = await listProjectMembers(db, args.projectId);
    const currentIds = new Set(current.map((member) => member.user_id));

    for (const member of current) {
        if (!desiredIds.has(member.user_id)) {
            await removeProjectMember(db, {
                projectId: args.projectId,
                projectOwnerId: args.projectOwnerId,
                actorUserId: args.actorUserId,
                targetUserId: member.user_id,
            });
        }
    }
    for (const userId of desiredIds) {
        if (!currentIds.has(userId)) {
            await addProjectMember(db, {
                projectId: args.projectId,
                projectOwnerId: args.projectOwnerId,
                projectOrganizationId: args.projectOrganizationId,
                actorUserId: args.actorUserId,
                targetUserId: userId,
            });
        }
    }

    return syncSharedWithFromMembers(db, args.projectId);
}
