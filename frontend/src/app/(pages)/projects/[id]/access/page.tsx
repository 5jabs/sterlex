"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import {
    accountGlassPrimaryButtonClassName,
} from "@/app/(pages)/account/accountStyles";
import { AddUserInput } from "@/app/components/shared/AddUserInput";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { useAuth } from "@/app/contexts/AuthContext";
import {
    addProjectMember,
    getProjectAccess,
    removeProjectMember,
    type ProjectAccess,
} from "@/app/lib/sterlexApi";

function personLabel(person: {
    display_name?: string | null;
    email?: string | null;
    user_id?: string;
}) {
    return person.display_name?.trim() || person.email || "Member";
}

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function ProjectAccessPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: projectId } = use(params);
    const router = useRouter();
    const { user } = useAuth();
    const [access, setAccess] = useState<ProjectAccess | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyUserId, setBusyUserId] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const next = await getProjectAccess(projectId);
        setAccess(next);
        return next;
    }, [projectId]);

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

    const memberIds = useMemo(
        () => new Set((access?.members ?? []).map((member) => member.user_id)),
        [access],
    );
    const suggested = (access?.organizationMembers ?? []).filter(
        (member) => !memberIds.has(member.user_id),
    );

    async function addByEmail(userToAdd: {
        email: string;
        display_name: string | null;
        user_id?: string;
    }) {
        setError(null);
        await addProjectMember(projectId, {
            email: userToAdd.email,
            user_id: userToAdd.user_id,
        });
        await reload();
    }

    async function addByUserId(userId: string) {
        setBusyUserId(userId);
        setError(null);
        try {
            await addProjectMember(projectId, { user_id: userId });
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusyUserId(null);
        }
    }

    async function remove(userId: string) {
        setBusyUserId(userId);
        setError(null);
        try {
            await removeProjectMember(projectId, userId);
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusyUserId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!access) {
        return (
            <div className="mx-auto max-w-xl px-6 py-16 text-center">
                <h1 className="font-serif text-2xl">Project not found</h1>
                <p className="mt-2 text-sm text-gray-500">{error}</p>
            </div>
        );
    }

    const canManage =
        access.project.can_manage_members ?? access.project.is_owner;
    const ownerEmail = access.owner.email?.trim().toLowerCase() ?? null;

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
            <PageHeader
                breadcrumbs={[
                    {
                        label: "Projects",
                        onClick: () => router.push("/projects"),
                    },
                    {
                        label: access.project.name,
                        onClick: () =>
                            router.push(`/projects/${access.project.id}`),
                    },
                    { label: "Access" },
                ]}
            />
            <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 md:px-6">
                <h2 className="mb-2 font-serif text-2xl font-medium text-gray-900">
                    Access
                </h2>
                <p className="mb-6 max-w-2xl text-sm text-gray-500">
                    Matter access stays explicit. Organization membership does
                    not open this project unless an admin has turned on
                    “admins can access all projects”.
                </p>

                {access.organizationName && (
                    <AccountSection className="mb-6 space-y-1 p-4">
                        <p className="text-sm font-medium text-gray-900">
                            {access.organizationName}
                        </p>
                        <p className="text-sm text-gray-500">
                            {access.orgAdminsCanAccessAll
                                ? "Organization owners and admins can currently open every project in this firm."
                                : "Only the people listed below can open this matter, even if they belong to the organization."}
                        </p>
                    </AccountSection>
                )}

                {canManage && (
                    <AccountSection className="mb-6 space-y-4 p-4">
                        <div>
                            <p className="mb-2 text-sm font-medium text-gray-800">
                                Add people
                            </p>
                            <AddUserInput
                                onAdd={addByEmail}
                                validateEmail={(email) => {
                                    if (ownerEmail && email === ownerEmail) {
                                        return "That person already owns this project.";
                                    }
                                    if (
                                        access.members.some(
                                            (member) =>
                                                member.email?.toLowerCase() ===
                                                email,
                                        )
                                    ) {
                                        return "This person already has access.";
                                    }
                                    return null;
                                }}
                                placeholder={
                                    access.project.organization_id
                                        ? "Add an organization colleague by email…"
                                        : "Add a Sterlex user by email…"
                                }
                                submitLabel="Add"
                                className="bg-white focus-within:bg-white"
                            />
                        </div>
                        {suggested.length > 0 && (
                            <div>
                                <p className="mb-2 text-xs font-medium text-gray-500">
                                    Organization colleagues not on this project
                                </p>
                                <ul className="space-y-1">
                                    {suggested.map((member) => (
                                        <li
                                            key={member.user_id}
                                            className="flex items-center gap-3 rounded-lg px-1 py-1.5"
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                                                <User className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm text-gray-900">
                                                    {personLabel(member)}
                                                </p>
                                                <p className="truncate text-xs text-gray-500">
                                                    {member.email} · {member.role}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                className={
                                                    accountGlassPrimaryButtonClassName
                                                }
                                                disabled={busyUserId !== null}
                                                onClick={() =>
                                                    void addByUserId(member.user_id)
                                                }
                                            >
                                                {busyUserId === member.user_id
                                                    ? "Adding…"
                                                    : "Add"}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </AccountSection>
                )}

                <AccountSection>
                    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                            <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">
                                {personLabel(access.owner)}
                                {access.owner.user_id === user?.id
                                    ? " · You"
                                    : ""}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                                {access.owner.email}
                            </p>
                        </div>
                        <span className="text-xs capitalize text-gray-500">
                            Owner
                        </span>
                    </div>
                    {access.members.map((member) => (
                        <div
                            key={member.user_id}
                            className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                                <User className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-gray-900">
                                    {personLabel(member)}
                                    {member.user_id === user?.id ? " · You" : ""}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                    {member.email}
                                </p>
                            </div>
                            <span className="text-xs capitalize text-gray-500">
                                Member
                            </span>
                            {(canManage || member.user_id === user?.id) && (
                                <button
                                    type="button"
                                    aria-label="Remove access"
                                    disabled={busyUserId !== null}
                                    onClick={() => void remove(member.user_id)}
                                    className="rounded-full p-1 text-gray-400 hover:text-red-600"
                                >
                                    {busyUserId === member.user_id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <X className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                    {access.members.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-500">
                            Only the owner has access so far.
                        </p>
                    )}
                </AccountSection>

                <h3 className="mb-3 mt-8 text-sm font-medium text-gray-800">
                    Access history
                </h3>
                <AccountSection>
                    {access.events.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-500">
                            Member changes will appear here.
                        </p>
                    ) : (
                        access.events.map((event) => {
                            const actor =
                                event.actor_display_name ||
                                event.actor_email ||
                                "Someone";
                            const target =
                                event.target_display_name ||
                                event.target_email ||
                                "a colleague";
                            return (
                                <div
                                    key={event.id}
                                    className="border-b border-gray-100 px-4 py-3 last:border-b-0"
                                >
                                    <p className="text-sm text-gray-800">
                                        {event.action === "member_added"
                                            ? `${actor} added ${target}`
                                            : `${actor} removed ${target}`}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatWhen(event.created_at)}
                                    </p>
                                </div>
                            );
                        })
                    )}
                </AccountSection>
                {error && (
                    <p className="mt-4 text-sm text-red-600">{error}</p>
                )}
            </div>
        </div>
    );
}
