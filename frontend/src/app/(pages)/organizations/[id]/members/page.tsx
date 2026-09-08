"use client";

import { useEffect, useState } from "react";
import { User, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import {
    accountGlassInputClassName,
    accountGlassPrimaryButtonClassName,
} from "@/app/(pages)/account/accountStyles";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    createOrganizationInvite,
    listOrganizationInvites,
    listOrganizationMembers,
    removeOrganizationMember,
    revokeOrganizationInvite,
    updateOrganizationMemberRole,
    type OrganizationInvite,
    type OrganizationMember,
    type OrgInviteRole,
    type OrgRole,
} from "@/app/lib/sterlexApi";

export default function OrganizationMembersPage() {
    const { organization } = useOrganizationSettings();
    const { user } = useAuth();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [invites, setInvites] = useState<OrganizationInvite[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<OrgInviteRole>("member");
    const [error, setError] = useState<string | null>(null);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
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

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Members
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                Invite colleagues by email. They keep their own Sterlex login
                and only see the projects you share with them.
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
                    {inviteUrl && (
                        <p className="break-all text-xs text-gray-500">
                            Invite link: {inviteUrl}
                        </p>
                    )}
                </AccountSection>
            )}

            <AccountSection>
                {members.map((member, index) => (
                    <div
                        key={member.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
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
                            </p>
                        </div>
                        {canManage && member.role !== "owner" ? (
                            <select
                                value={member.role}
                                onChange={(e) =>
                                    void updateOrganizationMemberRole(
                                        organization.id,
                                        member.user_id,
                                        e.target.value as OrgRole,
                                    ).then(setMembers)
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
                        {(canManage || member.user_id === user?.id) &&
                            member.role !== "owner" && (
                                <button
                                    type="button"
                                    aria-label="Remove member"
                                    onClick={() =>
                                        void removeOrganizationMember(
                                            organization.id,
                                            member.user_id,
                                        ).then(() => reload())
                                    }
                                    className="rounded-full p-1 text-gray-400 hover:text-red-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                    </div>
                ))}
            </AccountSection>

            {canManage && invites.length > 0 && (
                <AccountSection className="mt-8">
                    {invites.map((invite) => (
                        <div
                            key={invite.id}
                            className="flex items-center justify-between px-4 py-3"
                        >
                            <div>
                                <p className="text-sm text-gray-800">
                                    {invite.email}
                                </p>
                                <p className="text-xs capitalize text-gray-500">
                                    {invite.role} · pending
                                </p>
                            </div>
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
                    ))}
                </AccountSection>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}
