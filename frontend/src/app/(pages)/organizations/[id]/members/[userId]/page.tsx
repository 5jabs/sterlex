"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import {
    accountGlassDangerOutlineButtonClassName,
    accountGlassPrimaryButtonClassName,
} from "@/app/(pages)/account/accountStyles";
import { ConfirmPopup } from "@/app/components/popups/ConfirmPopup";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganizationSettings } from "../../OrganizationSettingsContext";
import {
    getOrganizationMemberDetail,
    grantOrganizationMemberProject,
    removeOrganizationMember,
    revokeOrganizationMemberProject,
    updateOrganizationMemberRole,
    type MemberProjectAccessVia,
    type OrganizationMemberDetail,
    type OrgRole,
} from "@/app/lib/sterlexApi";

function accessLabel(access: MemberProjectAccessVia) {
    if (access === "owner") return "Owner";
    if (access === "member") return "Added";
    if (access === "org_admin_all") return "Admin access to all projects";
    return "No access";
}

export default function OrganizationMemberDetailPage({
    params,
}: {
    params: Promise<{ id: string; userId: string }>;
}) {
    const { userId: memberUserId } = use(params);
    const { organization } = useOrganizationSettings();
    const { user } = useAuth();
    const router = useRouter();
    const [detail, setDetail] = useState<OrganizationMemberDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
    const [removeOpen, setRemoveOpen] = useState(false);
    const canManage =
        organization.role === "owner" || organization.role === "admin";

    const reload = useCallback(async () => {
        const next = await getOrganizationMemberDetail(
            organization.id,
            memberUserId,
        );
        setDetail(next);
        return next;
    }, [organization.id, memberUserId]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        reload()
            .then(() => {
                if (!cancelled) setError(null);
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error).message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reload]);

    async function grant(projectId: string) {
        setBusyProjectId(projectId);
        setError(null);
        try {
            await grantOrganizationMemberProject(
                organization.id,
                memberUserId,
                projectId,
            );
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusyProjectId(null);
        }
    }

    async function revoke(projectId: string) {
        setBusyProjectId(projectId);
        setError(null);
        try {
            await revokeOrganizationMemberProject(
                organization.id,
                memberUserId,
                projectId,
            );
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusyProjectId(null);
        }
    }

    async function changeRole(role: OrgRole) {
        setError(null);
        try {
            await updateOrganizationMemberRole(
                organization.id,
                memberUserId,
                role,
            );
            await reload();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    async function removeMember() {
        try {
            await removeOrganizationMember(organization.id, memberUserId);
            router.push(`/organizations/${organization.id}/members`);
        } catch (err) {
            setError((err as Error).message);
            setRemoveOpen(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!detail) {
        return (
            <div>
                <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                    Member
                </h2>
                <p className="text-sm text-red-600">{error || "Not found"}</p>
            </div>
        );
    }

    const member = detail.member;
    const isYou = member.user_id === user?.id;
    const canRemove =
        (canManage || isYou) && member.role !== "owner";
    const withAccess = detail.projects.filter(
        (project) => project.targetAccess !== "none",
    );
    const withoutAccess = detail.projects.filter(
        (project) => project.targetAccess === "none",
    );

    return (
        <div>
            <button
                type="button"
                className="mb-4 text-xs text-gray-500 hover:text-gray-800"
                onClick={() =>
                    router.push(`/organizations/${organization.id}/members`)
                }
            >
                ← Members
            </button>
            <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                    <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-2xl font-medium text-gray-900">
                        {member.display_name || member.email || "Member"}
                        {isYou ? " · You" : ""}
                    </h2>
                    <p className="truncate text-sm text-gray-500">
                        {member.email}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        Joined{" "}
                        {new Date(member.created_at).toLocaleDateString(
                            undefined,
                            {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            },
                        )}
                    </p>
                </div>
            </div>

            <AccountSection className="mb-8 space-y-4 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-800">
                            Organization role
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            Admins can manage members and keys. They still need
                            project access unless “admins can access all
                            projects” is on.
                        </p>
                    </div>
                    {canManage && member.role !== "owner" ? (
                        <select
                            value={member.role}
                            onChange={(e) =>
                                void changeRole(e.target.value as OrgRole)
                            }
                            className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs text-gray-700"
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            {organization.role === "owner" && (
                                <option value="owner">Owner</option>
                            )}
                        </select>
                    ) : (
                        <span className="text-xs capitalize text-gray-500">
                            {member.role}
                        </span>
                    )}
                </div>
                {detail.orgAdminsCanAccessAll &&
                    (member.role === "owner" || member.role === "admin") && (
                        <p className="text-xs text-amber-800">
                            This person can currently open every project because
                            admin access to all projects is on.
                        </p>
                    )}
            </AccountSection>

            <h3 className="mb-3 text-sm font-medium text-gray-800">
                Projects they can open
            </h3>
            <p className="mb-3 text-xs text-gray-500">
                Only matters you can already see are listed, so confidential
                names stay hidden.
            </p>
            <AccountSection className="mb-8">
                {withAccess.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-10 text-center">
                        <FolderOpen className="mb-3 h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-700">
                            No overlapping projects yet.
                        </p>
                    </div>
                ) : (
                    withAccess.map((project) => (
                        <div
                            key={project.id}
                            className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                        >
                            <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() =>
                                    router.push(`/projects/${project.id}`)
                                }
                            >
                                <p className="truncate text-sm text-gray-900">
                                    {project.name}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                    {accessLabel(project.targetAccess)}
                                    {project.cm_number
                                        ? ` · ${project.cm_number}`
                                        : ""}
                                </p>
                            </button>
                            {project.viewerCanRevoke && (
                                <Button
                                    type="button"
                                    className={
                                        accountGlassDangerOutlineButtonClassName
                                    }
                                    disabled={busyProjectId !== null}
                                    onClick={() => void revoke(project.id)}
                                >
                                    {busyProjectId === project.id
                                        ? "Removing…"
                                        : "Remove"}
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </AccountSection>

            {withoutAccess.length > 0 && (
                <>
                    <h3 className="mb-3 text-sm font-medium text-gray-800">
                        Projects without access
                    </h3>
                    <AccountSection className="mb-8">
                        {withoutAccess.map((project) => (
                            <div
                                key={project.id}
                                className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                            >
                                <button
                                    type="button"
                                    className="min-w-0 flex-1 text-left"
                                    onClick={() =>
                                        router.push(
                                            `/projects/${project.id}/access`,
                                        )
                                    }
                                >
                                    <p className="truncate text-sm text-gray-900">
                                        {project.name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        {accessLabel(project.targetAccess)}
                                    </p>
                                </button>
                                {project.viewerCanGrant && (
                                    <Button
                                        type="button"
                                        className={
                                            accountGlassPrimaryButtonClassName
                                        }
                                        disabled={busyProjectId !== null}
                                        onClick={() => void grant(project.id)}
                                    >
                                        {busyProjectId === project.id
                                            ? "Adding…"
                                            : "Grant access"}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </AccountSection>
                </>
            )}

            {canRemove && (
                <AccountSection className="p-4">
                    <h3 className="text-sm font-medium text-gray-900">
                        {isYou ? "Leave organization" : "Remove from organization"}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        This does not delete their Sterlex account. They lose
                        organization membership; project membership is separate.
                    </p>
                    <Button
                        type="button"
                        className={`${accountGlassDangerOutlineButtonClassName} mt-4`}
                        onClick={() => setRemoveOpen(true)}
                    >
                        {isYou ? "Leave" : "Remove member"}
                    </Button>
                </AccountSection>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <ConfirmPopup
                open={removeOpen}
                title={isYou ? "Leave this organization?" : "Remove this member?"}
                message={
                    isYou
                        ? "You will lose organization membership immediately."
                        : "They will lose organization membership immediately."
                }
                confirmLabel={isYou ? "Leave" : "Remove"}
                onCancel={() => setRemoveOpen(false)}
                onConfirm={() => void removeMember()}
            />
        </div>
    );
}
