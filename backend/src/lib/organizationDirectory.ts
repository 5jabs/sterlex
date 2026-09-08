import type { createServerSupabase } from "./supabase";
import { listAccessibleProjectIds } from "./access";
import { getOrganizationApiKeyStatus } from "./organizationApiKeys";
import {
    listOrganizationActivity,
    type OrganizationActivityEvent,
} from "./organizationActivity";
import { isOrgAdmin, type OrgRole } from "./organizationRoles";
import {
    getMembership,
    listOrganizationInvites,
    listOrganizationMembers,
    type OrganizationMemberRow,
    type OrganizationRow,
} from "./organizations";
import {
    addProjectMember,
    canManageProjectRoster,
    removeProjectMember,
} from "./projectMembers";
import {
    summarizeOrganizationUsage,
    withBudgetFields,
} from "./llmUsage";

type Db = ReturnType<typeof createServerSupabase>;

export type MemberProjectAccessVia =
    | "owner"
    | "member"
    | "org_admin_all"
    | "none";

export type MemberProjectAccess = {
    id: string;
    name: string;
    cm_number: string | null;
    practice: string | null;
    created_at: string;
    owner_user_id: string;
    targetAccess: MemberProjectAccessVia;
    viewerCanGrant: boolean;
    viewerCanRevoke: boolean;
};

export function describeProjectAccess(args: {
    projectOwnerId: string;
    userId: string;
    isExplicitMember: boolean;
    orgAdminsCanAccessAll: boolean;
    orgRole: OrgRole | null;
}): MemberProjectAccessVia {
    if (args.userId === args.projectOwnerId) return "owner";
    if (args.isExplicitMember) return "member";
    if (args.orgAdminsCanAccessAll && isOrgAdmin(args.orgRole)) {
        return "org_admin_all";
    }
    return "none";
}

async function loadOrgProjects(
    db: Db,
    organizationId: string,
): Promise<
    Array<{
        id: string;
        name: string;
        user_id: string;
        cm_number: string | null;
        practice: string | null;
        created_at: string;
    }>
> {
    const { data, error } = await db
        .from("projects")
        .select("id, name, user_id, cm_number, practice, created_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.name as string | null) ?? "Project",
        user_id: String(row.user_id),
        cm_number: (row.cm_number as string | null) ?? null,
        practice: (row.practice as string | null) ?? null,
        created_at: row.created_at as string,
    }));
}

async function loadExplicitMembersByProject(
    db: Db,
    projectIds: string[],
) {
    const membersByProject = new Map<string, Set<string>>();
    if (projectIds.length === 0) return membersByProject;
    const { data, error } = await db
        .from("project_members")
        .select("project_id, user_id")
        .in("project_id", projectIds);
    if (error) throw error;
    for (const row of data ?? []) {
        const projectId = row.project_id as string;
        const userId = String(row.user_id);
        const set = membersByProject.get(projectId) ?? new Set<string>();
        set.add(userId);
        membersByProject.set(projectId, set);
    }
    return membersByProject;
}

export async function listVisibleOrgProjects(
    db: Db,
    args: {
        organizationId: string;
        viewerUserId: string;
        viewerEmail?: string | null;
    },
) {
    const [projects, accessibleIds] = await Promise.all([
        loadOrgProjects(db, args.organizationId),
        listAccessibleProjectIds(args.viewerUserId, args.viewerEmail, db),
    ]);
    const accessible = new Set(accessibleIds);
    return projects.filter((project) => accessible.has(project.id));
}

export async function listOrganizationMembersWithProjectCounts(
    db: Db,
    args: {
        organizationId: string;
        viewerUserId: string;
        viewerEmail?: string | null;
        orgAdminsCanAccessAll: boolean;
    },
) {
    const [members, visibleProjects] = await Promise.all([
        listOrganizationMembers(db, args.organizationId),
        listVisibleOrgProjects(db, args),
    ]);
    const membersByProject = await loadExplicitMembersByProject(
        db,
        visibleProjects.map((project) => project.id),
    );
    const roleByUser = new Map(
        members.map((member) => [member.user_id, member.role]),
    );

    return members.map((member) => {
        let projectCount = 0;
        for (const project of visibleProjects) {
            const access = describeProjectAccess({
                projectOwnerId: project.user_id,
                userId: member.user_id,
                isExplicitMember:
                    membersByProject.get(project.id)?.has(member.user_id) ===
                    true,
                orgAdminsCanAccessAll: args.orgAdminsCanAccessAll,
                orgRole: roleByUser.get(member.user_id) ?? null,
            });
            if (access !== "none") projectCount += 1;
        }
        return { ...member, project_count: projectCount };
    });
}

export async function getOrganizationMemberDetail(
    db: Db,
    args: {
        organization: OrganizationRow;
        viewerUserId: string;
        viewerEmail?: string | null;
        viewerRole: OrgRole;
        memberUserId: string;
    },
) {
    const members = await listOrganizationMembers(db, args.organization.id);
    const member = members.find((row) => row.user_id === args.memberUserId);
    if (!member) {
        throw Object.assign(new Error("Member not found."), { status: 404 });
    }

    const visibleProjects = await listVisibleOrgProjects(db, {
        organizationId: args.organization.id,
        viewerUserId: args.viewerUserId,
        viewerEmail: args.viewerEmail,
    });
    const membersByProject = await loadExplicitMembersByProject(
        db,
        visibleProjects.map((project) => project.id),
    );
    const orgAdminsCanAccessAll =
        args.organization.admins_can_access_all_projects === true;

    const projects: MemberProjectAccess[] = visibleProjects.map((project) => {
        const targetAccess = describeProjectAccess({
            projectOwnerId: project.user_id,
            userId: member.user_id,
            isExplicitMember:
                membersByProject.get(project.id)?.has(member.user_id) === true,
            orgAdminsCanAccessAll,
            orgRole: member.role,
        });
        const viewerCanManage = canManageProjectRoster({
            actorUserId: args.viewerUserId,
            projectOwnerId: project.user_id,
            actorOrgRole: args.viewerRole,
        });
        return {
            id: project.id,
            name: project.name,
            cm_number: project.cm_number,
            practice: project.practice,
            created_at: project.created_at,
            owner_user_id: project.user_id,
            targetAccess,
            viewerCanGrant:
                viewerCanManage &&
                targetAccess !== "owner" &&
                targetAccess !== "member",
            viewerCanRevoke: viewerCanManage && targetAccess === "member",
        };
    });

    projects.sort((a, b) => {
        const rank = (access: MemberProjectAccessVia) =>
            access === "none" ? 1 : 0;
        const byAccess = rank(a.targetAccess) - rank(b.targetAccess);
        if (byAccess !== 0) return byAccess;
        return a.name.localeCompare(b.name);
    });

    return {
        member,
        orgAdminsCanAccessAll,
        viewerCanManageMember: isOrgAdmin(args.viewerRole),
        projects,
    };
}

export async function grantOrganizationMemberProjectAccess(
    db: Db,
    args: {
        organizationId: string;
        actorUserId: string;
        actorOrgRole: OrgRole;
        memberUserId: string;
        projectId: string;
    },
) {
    const membership = await getMembership(
        db,
        args.organizationId,
        args.memberUserId,
    );
    if (!membership) {
        throw Object.assign(
            new Error("That person is not a member of this organization."),
            { status: 400 },
        );
    }
    const { data: project, error } = await db
        .from("projects")
        .select("id, user_id, organization_id")
        .eq("id", args.projectId)
        .maybeSingle();
    if (error) throw error;
    if (!project || project.organization_id !== args.organizationId) {
        throw Object.assign(new Error("Project not found."), { status: 404 });
    }
    if (
        !canManageProjectRoster({
            actorUserId: args.actorUserId,
            projectOwnerId: String(project.user_id),
            actorOrgRole: args.actorOrgRole,
        })
    ) {
        throw Object.assign(
            new Error("Only the project owner or an organization admin can add people."),
            { status: 403 },
        );
    }
    return addProjectMember(db, {
        projectId: args.projectId,
        projectOwnerId: String(project.user_id),
        projectOrganizationId: args.organizationId,
        actorUserId: args.actorUserId,
        targetUserId: args.memberUserId,
    });
}

export async function revokeOrganizationMemberProjectAccess(
    db: Db,
    args: {
        organizationId: string;
        actorUserId: string;
        actorOrgRole: OrgRole;
        memberUserId: string;
        projectId: string;
    },
) {
    const { data: project, error } = await db
        .from("projects")
        .select("id, user_id, organization_id")
        .eq("id", args.projectId)
        .maybeSingle();
    if (error) throw error;
    if (!project || project.organization_id !== args.organizationId) {
        throw Object.assign(new Error("Project not found."), { status: 404 });
    }
    if (
        !canManageProjectRoster({
            actorUserId: args.actorUserId,
            projectOwnerId: String(project.user_id),
            actorOrgRole: args.actorOrgRole,
        })
    ) {
        throw Object.assign(
            new Error(
                "Only the project owner or an organization admin can remove people.",
            ),
            { status: 403 },
        );
    }
    await removeProjectMember(db, {
        projectId: args.projectId,
        projectOwnerId: String(project.user_id),
        actorUserId: args.actorUserId,
        targetUserId: args.memberUserId,
    });
}

function configuredKeyCount(status: Record<string, unknown>) {
    const providers = ["claude", "gemini", "openai", "openrouter", "courtlistener"];
    return providers.filter((provider) => status[provider] === true).length;
}

export async function getOrganizationOverview(
    db: Db,
    args: {
        organization: OrganizationRow;
        viewerUserId: string;
        viewerEmail?: string | null;
        viewerRole: OrgRole;
    },
): Promise<{
    memberCount: number;
    pendingInviteCount: number;
    visibleProjectCount: number;
    configuredKeyCount: number;
    usage: ReturnType<typeof withBudgetFields>;
    recentActivity: OrganizationActivityEvent[];
    members: Array<
        OrganizationMemberRow & {
            email?: string | null;
            display_name?: string | null;
            project_count: number;
        }
    >;
}> {
    const visibleProjects = await listVisibleOrgProjects(db, {
        organizationId: args.organization.id,
        viewerUserId: args.viewerUserId,
        viewerEmail: args.viewerEmail,
    });
    const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
    const canSeeInvites = isOrgAdmin(args.viewerRole);

    const [members, invites, keys, usage, recentActivity] = await Promise.all([
        listOrganizationMembersWithProjectCounts(db, {
            organizationId: args.organization.id,
            viewerUserId: args.viewerUserId,
            viewerEmail: args.viewerEmail,
            orgAdminsCanAccessAll:
                args.organization.admins_can_access_all_projects === true,
        }),
        canSeeInvites
            ? listOrganizationInvites(db, args.organization.id)
            : Promise.resolve([]),
        getOrganizationApiKeyStatus(args.organization.id, db),
        summarizeOrganizationUsage(db, args.organization.id),
        listOrganizationActivity(db, {
            organizationId: args.organization.id,
            visibleProjectIds,
            limit: 8,
        }),
    ]);

    const monthlyBudgetUsd =
        args.organization.monthly_budget_usd == null
            ? null
            : Number(args.organization.monthly_budget_usd);

    return {
        memberCount: members.length,
        pendingInviteCount: invites.length,
        visibleProjectCount: visibleProjects.length,
        configuredKeyCount: configuredKeyCount(keys),
        usage: withBudgetFields(
            usage,
            monthlyBudgetUsd,
            args.organization.budget_enforcement,
        ),
        recentActivity,
        members: members.slice(0, 8),
    };
}
