import { Router } from "express";
import { requireAuth, requireMfaIfEnrolled } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import {
    acceptOrganizationInvite,
    acceptOrganizationInviteById,
    canDeleteOrganization,
    canManageOrgKeys,
    canManageOrgMembers,
    canManageOrgSettings,
    changeMemberRole,
    createOrganization,
    createOrganizationInvite,
    deleteOrganization,
    getActiveOrganizationId,
    getInviteByToken,
    getMembership,
    listOrganizationInvites,
    listOrganizationMembers,
    listPendingInvitesForEmail,
    listUserOrganizations,
    recordOrganizationSettingsActivity,
    regenerateOrganizationInviteLink,
    removeOrganizationMember,
    revokeOrganizationInvite,
    setActiveOrganization,
    transferOrganizationOwnership,
    updateOrganization,
} from "../lib/organizations";
import {
    isBudgetEnforcement,
    isOrgInviteRole,
    isOrgRole,
} from "../lib/organizationRoles";
import {
    getOrganizationApiKeyStatus,
    saveOrganizationApiKey,
} from "../lib/organizationApiKeys";
import {
    hasEnvApiKey,
    normalizeApiKeyProvider,
} from "../lib/userApiKeys";
import {
    summarizeOrganizationUsage,
    withBudgetFields,
} from "../lib/llmUsage";
import { checkProjectAccess, listAccessibleProjectIds } from "../lib/access";
import {
    listOrganizationActivity,
    recordOrganizationActivity,
} from "../lib/organizationActivity";
import {
    getOrganizationMemberDetail,
    getOrganizationOverview,
    grantOrganizationMemberProjectAccess,
    listOrganizationMembersWithProjectCounts,
    revokeOrganizationMemberProjectAccess,
} from "../lib/organizationDirectory";

export const organizationsRouter = Router();

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

function errorStatus(error: unknown): number {
    const explicit =
        error && typeof error === "object"
            ? (error as { status?: unknown; code?: unknown }).status
            : undefined;
    if (typeof explicit === "number") return explicit;
    const code =
        error && typeof error === "object"
            ? (error as { code?: unknown }).code
            : undefined;
    if (code === "not_a_member") return 403;
    if (code === "org_has_projects") return 409;
    const message = errorMessage(error).toLowerCase();
    if (message.includes("not found")) return 404;
    if (
        message.includes("required") ||
        message.includes("already") ||
        message.includes("only ") ||
        message.includes("cannot") ||
        message.includes("invalid") ||
        message.includes("different email") ||
        message.includes("no longer valid")
    ) {
        return 400;
    }
    return 500;
}

function inviteUrl(token: string) {
    const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
        /\/+$/,
        "",
    );
    return `${base}/organizations/invites/${encodeURIComponent(token)}`;
}

async function requireMembership(
    organizationId: string,
    userId: string,
) {
    const db = createServerSupabase();
    const membership = await getMembership(db, organizationId, userId);
    if (!membership) {
        const err = new Error("Organization not found");
        (err as { code?: string }).code = "not_found";
        throw err;
    }
    return { db, ...membership };
}

organizationsRouter.get("/", requireAuth, async (_req, res) => {
    const userId = res.locals.userId as string;
    const db = createServerSupabase();
    try {
        const [organizations, storedActiveId, pendingInvites] =
            await Promise.all([
                listUserOrganizations(db, userId),
                getActiveOrganizationId(db, userId),
                listPendingInvitesForEmail(db, res.locals.userEmail as string),
            ]);
        const memberIds = new Set(organizations.map((org) => org.id));
        const activeOrganizationId =
            storedActiveId && memberIds.has(storedActiveId)
                ? storedActiveId
                : null;
        if (storedActiveId && !activeOrganizationId) {
            await setActiveOrganization(db, userId, null);
        }
        res.json({
            organizations,
            activeOrganizationId,
            pendingInvites: pendingInvites.map((invite) => ({
                id: invite.id,
                organizationId: invite.organization_id,
                organizationName: invite.organization_name ?? null,
                role: invite.role,
                email: invite.email,
                expiresAt: invite.expires_at,
            })),
        });
    } catch (err) {
        res.status(500).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.post("/", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    if (!name.trim()) {
        return void res.status(400).json({ detail: "name is required" });
    }
    const db = createServerSupabase();
    try {
        const organization = await createOrganization(db, { userId, name });
        res.status(201).json(organization);
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.patch("/active", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const raw = req.body?.organizationId;
    const organizationId =
        raw === null || raw === ""
            ? null
            : typeof raw === "string"
              ? raw
              : undefined;
    if (organizationId === undefined) {
        return void res
            .status(400)
            .json({ detail: "organizationId must be a string or null" });
    }
    const db = createServerSupabase();
    try {
        const activeOrganizationId = await setActiveOrganization(
            db,
            userId,
            organizationId,
        );
        res.json({ activeOrganizationId });
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.get("/invites/pending", requireAuth, async (_req, res) => {
    const db = createServerSupabase();
    try {
        const invites = await listPendingInvitesForEmail(
            db,
            res.locals.userEmail as string,
        );
        res.json(invites);
    } catch (err) {
        res.status(500).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.post(
    "/invites/pending/:inviteId/accept",
    requireAuth,
    async (req, res) => {
        const db = createServerSupabase();
        try {
            const membership = await acceptOrganizationInviteById(db, {
                inviteId: req.params.inviteId,
                userId: res.locals.userId as string,
                userEmail: res.locals.userEmail as string,
            });
            res.json({
                ...membership.organization,
                role: membership.role,
            });
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get("/invites/:token", requireAuth, async (req, res) => {
    const db = createServerSupabase();
    try {
        const invite = await getInviteByToken(db, req.params.token);
        if (!invite) {
            return void res.status(404).json({ detail: "Invite not found." });
        }
        res.json({
            id: invite.id,
            organizationId: invite.organization_id,
            organizationName: invite.organization_name ?? null,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            expiresAt: invite.expires_at,
        });
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.post("/invites/:token/accept", requireAuth, async (req, res) => {
    const db = createServerSupabase();
    try {
        const membership = await acceptOrganizationInvite(db, {
            token: req.params.token,
            userId: res.locals.userId as string,
            userEmail: res.locals.userEmail as string,
        });
        res.json({
            ...membership.organization,
            role: membership.role,
        });
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.get("/:organizationId", requireAuth, async (req, res) => {
    try {
        const { organization, role } = await requireMembership(
            req.params.organizationId,
            res.locals.userId as string,
        );
        res.json({ ...organization, role });
    } catch (err) {
        const status = errorMessage(err).includes("not found") ? 404 : errorStatus(err);
        res.status(status).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.patch("/:organizationId", requireAuth, async (req, res) => {
    try {
        const { db, role, organization } = await requireMembership(
            req.params.organizationId,
            res.locals.userId as string,
        );
        if (!canManageOrgSettings(role)) {
            return void res
                .status(403)
                .json({ detail: "Only owners and admins can update the organization." });
        }
        const patch: {
            name?: string;
            admins_can_access_all_projects?: boolean;
            monthly_budget_usd?: number | null;
            budget_enforcement?: "off" | "soft" | "hard";
        } = {};
        if ("name" in (req.body ?? {})) {
            if (typeof req.body.name !== "string") {
                return void res.status(400).json({ detail: "name must be a string" });
            }
            patch.name = req.body.name;
        }
        if ("adminsCanAccessAllProjects" in (req.body ?? {})) {
            if (typeof req.body.adminsCanAccessAllProjects !== "boolean") {
                return void res.status(400).json({
                    detail: "adminsCanAccessAllProjects must be a boolean",
                });
            }
            patch.admins_can_access_all_projects =
                req.body.adminsCanAccessAllProjects;
        }
        if ("monthlyBudgetUsd" in (req.body ?? {})) {
            const value = req.body.monthlyBudgetUsd;
            if (value !== null && (typeof value !== "number" || value < 0)) {
                return void res.status(400).json({
                    detail: "monthlyBudgetUsd must be a positive number or null",
                });
            }
            patch.monthly_budget_usd = value;
        }
        if ("budgetEnforcement" in (req.body ?? {})) {
            if (!isBudgetEnforcement(req.body.budgetEnforcement)) {
                return void res.status(400).json({
                    detail: "budgetEnforcement must be off, soft, or hard",
                });
            }
            patch.budget_enforcement = req.body.budgetEnforcement;
        }
        const updated = await updateOrganization(db, organization.id, patch);
        await recordOrganizationSettingsActivity(db, {
            organizationId: organization.id,
            actorUserId: res.locals.userId as string,
            fields: Object.keys(patch),
        });
        res.json({ ...updated, role });
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.delete("/:organizationId", requireAuth, async (req, res) => {
    try {
        const { db, role, organization } = await requireMembership(
            req.params.organizationId,
            res.locals.userId as string,
        );
        if (!canDeleteOrganization(role)) {
            return void res
                .status(403)
                .json({ detail: "Only the owner can delete this organization." });
        }
        await deleteOrganization(db, organization.id);
        res.status(204).send();
    } catch (err) {
        res.status(errorStatus(err)).json({ detail: errorMessage(err) });
    }
});

organizationsRouter.get(
    "/:organizationId/members",
    requireAuth,
    async (req, res) => {
        try {
            const { db, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const members = await listOrganizationMembersWithProjectCounts(db, {
                organizationId: organization.id,
                viewerUserId: res.locals.userId as string,
                viewerEmail: res.locals.userEmail as string,
                orgAdminsCanAccessAll:
                    organization.admins_can_access_all_projects === true,
            });
            res.json(members);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/overview",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const overview = await getOrganizationOverview(db, {
                organization,
                viewerUserId: res.locals.userId as string,
                viewerEmail: res.locals.userEmail as string,
                viewerRole: role,
            });
            res.json(overview);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/activity",
    requireAuth,
    async (req, res) => {
        try {
            const { db, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const accessible = await listAccessibleProjectIds(
                res.locals.userId as string,
                res.locals.userEmail as string,
                db,
            );
            const events = await listOrganizationActivity(db, {
                organizationId: organization.id,
                visibleProjectIds: new Set(accessible),
                limit: Number(req.query.limit) || 50,
            });
            res.json(events);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/members/:memberUserId",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const detail = await getOrganizationMemberDetail(db, {
                organization,
                viewerUserId: res.locals.userId as string,
                viewerEmail: res.locals.userEmail as string,
                viewerRole: role,
                memberUserId: req.params.memberUserId,
            });
            res.json(detail);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.post(
    "/:organizationId/members/:memberUserId/projects",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const projectId =
                typeof req.body?.projectId === "string"
                    ? req.body.projectId
                    : typeof req.body?.project_id === "string"
                      ? req.body.project_id
                      : "";
            if (!projectId) {
                return void res
                    .status(400)
                    .json({ detail: "projectId is required" });
            }
            const access = await checkProjectAccess(
                projectId,
                res.locals.userId as string,
                res.locals.userEmail as string,
                db,
            );
            if (!access.ok) {
                return void res.status(404).json({ detail: "Project not found." });
            }
            const member = await grantOrganizationMemberProjectAccess(db, {
                organizationId: organization.id,
                actorUserId: res.locals.userId as string,
                actorOrgRole: role,
                memberUserId: req.params.memberUserId,
                projectId,
            });
            res.status(201).json(member);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.delete(
    "/:organizationId/members/:memberUserId/projects/:projectId",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const access = await checkProjectAccess(
                req.params.projectId,
                res.locals.userId as string,
                res.locals.userEmail as string,
                db,
            );
            if (!access.ok) {
                return void res.status(404).json({ detail: "Project not found." });
            }
            await revokeOrganizationMemberProjectAccess(db, {
                organizationId: organization.id,
                actorUserId: res.locals.userId as string,
                actorOrgRole: role,
                memberUserId: req.params.memberUserId,
                projectId: req.params.projectId,
            });
            res.status(204).send();
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.patch(
    "/:organizationId/members/:memberUserId",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgMembers(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can change roles.",
                });
            }
            const nextRole = req.body?.role;
            if (!isOrgRole(nextRole)) {
                return void res.status(400).json({ detail: "Invalid role." });
            }
            if (nextRole === "owner") {
                await transferOrganizationOwnership(db, {
                    organizationId: organization.id,
                    actorUserId: res.locals.userId as string,
                    actorRole: role,
                    targetUserId: req.params.memberUserId,
                });
                const members = await listOrganizationMembers(db, organization.id);
                return void res.json(members);
            }
            await changeMemberRole(db, {
                organizationId: organization.id,
                actorUserId: res.locals.userId as string,
                actorRole: role,
                targetUserId: req.params.memberUserId,
                nextRole,
            });
            const members = await listOrganizationMembers(db, organization.id);
            res.json(members);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.delete(
    "/:organizationId/members/:memberUserId",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            await removeOrganizationMember(db, {
                organizationId: organization.id,
                actorUserId: res.locals.userId as string,
                actorRole: role,
                targetUserId: req.params.memberUserId,
            });
            res.status(204).send();
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/invites",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgMembers(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can view invites.",
                });
            }
            const invites = await listOrganizationInvites(db, organization.id);
            res.json(invites);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.post(
    "/:organizationId/invites",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgMembers(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can invite members.",
                });
            }
            const email = typeof req.body?.email === "string" ? req.body.email : "";
            const inviteRole = isOrgInviteRole(req.body?.role)
                ? req.body.role
                : "member";
            const { invite, token } = await createOrganizationInvite(db, {
                organizationId: organization.id,
                email,
                role: inviteRole,
                invitedBy: res.locals.userId as string,
            });
            res.status(201).json({
                ...invite,
                acceptUrl: inviteUrl(token),
            });
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.delete(
    "/:organizationId/invites/:inviteId",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgMembers(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can revoke invites.",
                });
            }
            await revokeOrganizationInvite(db, {
                organizationId: organization.id,
                inviteId: req.params.inviteId,
                actorUserId: res.locals.userId as string,
            });
            res.status(204).send();
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.post(
    "/:organizationId/invites/:inviteId/link",
    requireAuth,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgMembers(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can generate invite links.",
                });
            }
            const { invite, token } = await regenerateOrganizationInviteLink(db, {
                organizationId: organization.id,
                inviteId: req.params.inviteId,
                actorUserId: res.locals.userId as string,
            });
            res.json({
                ...invite,
                acceptUrl: inviteUrl(token),
            });
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/api-keys",
    requireAuth,
    async (req, res) => {
        try {
            const { db, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const status = await getOrganizationApiKeyStatus(
                organization.id,
                db,
            );
            res.json(status);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.put(
    "/:organizationId/api-keys/:provider",
    requireAuth,
    requireMfaIfEnrolled,
    async (req, res) => {
        try {
            const { db, role, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            if (!canManageOrgKeys(role)) {
                return void res.status(403).json({
                    detail: "Only owners and admins can manage organization API keys.",
                });
            }
            const provider = normalizeApiKeyProvider(req.params.provider);
            if (!provider) {
                return void res
                    .status(400)
                    .json({ detail: "Unsupported provider" });
            }
            if (hasEnvApiKey(provider) && process.env.ORG_API_KEYS_ALLOW_ENV === "true") {
                // Org keys remain independently configurable.
            }
            const apiKey =
                typeof req.body?.api_key === "string" ? req.body.api_key : null;
            await saveOrganizationApiKey(organization.id, provider, apiKey, db);
            await recordOrganizationActivity(db, {
                organizationId: organization.id,
                actorUserId: res.locals.userId as string,
                action: apiKey ? "api_key_saved" : "api_key_removed",
                metadata: { provider },
            });
            const status = await getOrganizationApiKeyStatus(
                organization.id,
                db,
            );
            res.json(status);
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);

organizationsRouter.get(
    "/:organizationId/usage",
    requireAuth,
    async (req, res) => {
        try {
            const { db, organization } = await requireMembership(
                req.params.organizationId,
                res.locals.userId as string,
            );
            const usage = await summarizeOrganizationUsage(db, organization.id);
            const monthlyBudgetUsd =
                organization.monthly_budget_usd == null
                    ? null
                    : Number(organization.monthly_budget_usd);
            res.json(
                withBudgetFields(
                    usage,
                    monthlyBudgetUsd,
                    organization.budget_enforcement,
                ),
            );
        } catch (err) {
            res.status(errorStatus(err)).json({ detail: errorMessage(err) });
        }
    },
);
