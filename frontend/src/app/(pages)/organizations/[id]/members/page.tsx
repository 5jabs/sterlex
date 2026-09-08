"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import {
    accountGlassInputClassName,
    accountGlassPrimaryButtonClassName,
} from "@/app/(pages)/account/accountStyles";
import { InviteLinkCard } from "@/app/components/organizations/InviteLinkCard";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    createOrganizationInvite,
    listOrganizationInvites,
    listOrganizationMembers,
    regenerateOrganizationInviteLink,
    revokeOrganizationInvite,
    type OrganizationInvite,
    type OrganizationMember,
    type OrgInviteRole,
} from "@/app/lib/sterlexApi";

export default function OrganizationMembersPage() {
    const { organization } = useOrganizationSettings();
    const { user } = useAuth();
    const router = useRouter();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [invites, setInvites] = useState<OrganizationInvite[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<OrgInviteRole>("member");
    const [error, setError] = useState<string | null>(null);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
    const canManage =
        organization.role === "owner" || organization.role === "admin";

    async function reload() {
        const nextMembers = await listOrganizationMembers(organization.id);
        setMembers(nextMembers);
        if (canManage) {
            setInvites(await listOrganizationInvites(organization.id));
        }
    }

    useEffect(() => {
        void reload().catch((err) => setError((err as Error).message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization.id]);

    async function invite() {
        setSending(true);
        setError(null);
        setInviteUrl(null);
        try {
            const created = await createOrganizationInvite(organization.id, {
                email,
                role,
            });
            setEmail("");
            setInviteUrl(created.acceptUrl ?? null);
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSending(false);
        }
    }

    async function generateLink(inviteId: string) {
        setLinkBusyId(inviteId);
        setError(null);
        try {
            const next = await regenerateOrganizationInviteLink(
                organization.id,
                inviteId,
            );
            setInviteUrl(next.acceptUrl ?? null);
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLinkBusyId(null);
        }
    }

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Members
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                Invite colleagues by email, then send them the link yourself.
                Being in the organization does not open every project — open a
                person to grant matter access.
            </p>
            {canManage && (
                <AccountSection className="mb-8 space-y-3 p-4">
                    <div className="flex flex-col gap-2 md:flex-row">
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@firm.com"
                            className={accountGlassInputClassName}
                        />
                        <select
                            value={role}
                            onChange={(e) =>
                                setRole(e.target.value as OrgInviteRole)
                            }
                            className={`${accountGlassInputClassName} h-10 md:w-36`}
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                        <Button
                            type="button"
                            className={accountGlassPrimaryButtonClassName}
                            disabled={!email.trim() || sending}
                            onClick={() => void invite()}
                        >
                            {sending ? "Inviting…" : "Invite"}
                        </Button>
                    </div>
                    {inviteUrl && <InviteLinkCard url={inviteUrl} />}
                </AccountSection>
            )}

            <AccountSection>
                {members.map((member, index) => (
                    <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                            router.push(
                                `/organizations/${organization.id}/members/${member.user_id}`,
                            )
                        }
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/80 ${
                            index < members.length - 1
                                ? "border-b border-gray-100"
                                : ""
                        }`}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                            <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">
                                {member.display_name || member.email || "Member"}
                                {member.user_id === user?.id ? " · You" : ""}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                                {member.email}
                                {typeof member.project_count === "number"
                                    ? ` · ${member.project_count} project${
                                          member.project_count === 1 ? "" : "s"
                                      }`
                                    : ""}
                            </p>
                        </div>
                        <span className="text-xs capitalize text-gray-500">
                            {member.role}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                ))}
            </AccountSection>

            {canManage && (
                <div className="mt-8">
                    <h3 className="mb-3 text-sm font-medium text-gray-800">
                        Pending invites
                    </h3>
                    <AccountSection>
                        {invites.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-gray-500">
                                No pending invites. Sterlex does not send email —
                                copy the link after inviting someone.
                            </p>
                        ) : (
                            invites.map((invite) => (
                                <div
                                    key={invite.id}
                                    className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p className="text-sm text-gray-800">
                                            {invite.email}
                                        </p>
                                        <p className="text-xs capitalize text-gray-500">
                                            {invite.role} · expires{" "}
                                            {new Date(
                                                invite.expires_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            disabled={linkBusyId !== null}
                                            onClick={() =>
                                                void generateLink(invite.id)
                                            }
                                            className="text-xs text-gray-700 hover:text-gray-900"
                                        >
                                            {linkBusyId === invite.id
                                                ? "Generating…"
                                                : "Generate link"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void revokeOrganizationInvite(
                                                    organization.id,
                                                    invite.id,
                                                ).then(() => reload())
                                            }
                                            className="text-xs text-red-600"
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </AccountSection>
                </div>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}
