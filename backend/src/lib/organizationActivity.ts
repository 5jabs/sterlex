import type { createServerSupabase } from "./supabase";

type Db = ReturnType<typeof createServerSupabase>;

export const ORGANIZATION_ACTIVITY_ACTIONS = [
    "organization_created",
    "settings_updated",
    "member_joined",
    "member_removed",
    "member_role_changed",
    "ownership_transferred",
    "invite_created",
    "invite_accepted",
    "invite_revoked",
    "invite_link_regenerated",
    "project_member_added",
    "project_member_removed",
    "api_key_saved",
    "api_key_removed",
] as const;

export type OrganizationActivityAction =
    (typeof ORGANIZATION_ACTIVITY_ACTIONS)[number];

export type OrganizationActivityEvent = {
    id: string;
    organization_id: string;
    actor_user_id: string | null;
    action: OrganizationActivityAction;
    target_user_id: string | null;
    target_email: string | null;
    project_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    actor_display_name: string | null;
    actor_email: string | null;
    target_display_name: string | null;
    project_name: string | null;
};

export async function recordOrganizationActivity(
    db: Db,
    input: {
        organizationId: string;
        actorUserId?: string | null;
        action: OrganizationActivityAction;
        targetUserId?: string | null;
        targetEmail?: string | null;
        projectId?: string | null;
        metadata?: Record<string, unknown>;
    },
) {
    const { error } = await db.from("organization_activity_events").insert({
        organization_id: input.organizationId,
        actor_user_id: input.actorUserId ?? null,
        action: input.action,
        target_user_id: input.targetUserId ?? null,
        target_email: input.targetEmail ?? null,
        project_id: input.projectId ?? null,
        metadata: input.metadata ?? {},
    });
    if (error) {
        console.error(
            "[organization-activity] failed to record event",
            error.message,
        );
    }
}

export async function listOrganizationActivity(
    db: Db,
    args: {
        organizationId: string;
        visibleProjectIds: Set<string>;
        limit?: number;
    },
): Promise<OrganizationActivityEvent[]> {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const { data, error } = await db
        .from("organization_activity_events")
        .select(
            "id, organization_id, actor_user_id, action, target_user_id, target_email, project_id, metadata, created_at",
        )
        .eq("organization_id", args.organizationId)
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 3, 80));
    if (error) throw error;

    const rows = (data ?? []).filter((row) => {
        const projectId = (row.project_id as string | null) ?? null;
        if (!projectId) return true;
        return args.visibleProjectIds.has(projectId);
    }).slice(0, limit);

    const userIds = [
        ...new Set(
            rows.flatMap((row) =>
                [row.actor_user_id, row.target_user_id].filter(
                    (id): id is string => typeof id === "string" && !!id,
                ),
            ),
        ),
    ];
    const projectIds = [
        ...new Set(
            rows
                .map((row) => row.project_id as string | null)
                .filter((id): id is string => typeof id === "string" && !!id),
        ),
    ];

    const [{ data: profiles, error: profileError }, { data: projects, error: projectError }] =
        await Promise.all([
            userIds.length
                ? db
                      .from("user_profiles")
                      .select("user_id, email, display_name")
                      .in("user_id", userIds)
                : Promise.resolve({ data: [], error: null }),
            projectIds.length
                ? db.from("projects").select("id, name").in("id", projectIds)
                : Promise.resolve({ data: [], error: null }),
        ]);
    if (profileError) throw profileError;
    if (projectError) throw projectError;

    const profileById = new Map(
        (profiles ?? []).map((row) => [row.user_id as string, row]),
    );
    const projectById = new Map(
        (projects ?? []).map((row) => [row.id as string, row]),
    );

    return rows.map((row) => {
        const actor = row.actor_user_id
            ? profileById.get(row.actor_user_id as string)
            : null;
        const target = row.target_user_id
            ? profileById.get(row.target_user_id as string)
            : null;
        const project = row.project_id
            ? projectById.get(row.project_id as string)
            : null;
        const metadata =
            row.metadata &&
            typeof row.metadata === "object" &&
            !Array.isArray(row.metadata)
                ? (row.metadata as Record<string, unknown>)
                : {};
        return {
            id: row.id as string,
            organization_id: row.organization_id as string,
            actor_user_id: (row.actor_user_id as string | null) ?? null,
            action: row.action as OrganizationActivityAction,
            target_user_id: (row.target_user_id as string | null) ?? null,
            target_email: (row.target_email as string | null) ?? null,
            project_id: (row.project_id as string | null) ?? null,
            metadata,
            created_at: row.created_at as string,
            actor_display_name:
                (actor?.display_name as string | null) ?? null,
            actor_email: (actor?.email as string | null) ?? null,
            target_display_name:
                (target?.display_name as string | null) ?? null,
            project_name: (project?.name as string | null) ?? null,
        };
    });
}
