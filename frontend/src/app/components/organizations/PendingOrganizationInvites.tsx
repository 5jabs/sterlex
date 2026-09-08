"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { accountGlassPrimaryButtonClassName } from "@/app/(pages)/account/accountStyles";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { acceptPendingOrganizationInvite } from "@/app/lib/sterlexApi";

export function PendingOrganizationInvites({
    compact = false,
}: {
    compact?: boolean;
}) {
    const { pendingInvites, reload, enterWorkspace } = useOrganization();
    const router = useRouter();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (pendingInvites.length === 0) return null;

    async function accept(inviteId: string, organizationId: string) {
        setBusyId(inviteId);
        setError(null);
        try {
            await acceptPendingOrganizationInvite(inviteId);
            await reload();
            await enterWorkspace(organizationId);
            router.push("/projects");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusyId(null);
        }
    }

    const list = (
        <ul className="space-y-2">
            {pendingInvites.map((invite) => (
                <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3"
                >
                    <div className="min-w-0">
                        <p className="truncate text-sm text-gray-900">
                            {invite.organizationName || "Organization"}
                        </p>
                        <p className="text-xs capitalize text-gray-500">
                            {invite.role}
                            {invite.expiresAt
                                ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`
                                : ""}
                        </p>
                    </div>
                    <Button
                        type="button"
                        className={accountGlassPrimaryButtonClassName}
                        disabled={busyId !== null}
                        onClick={() =>
                            void accept(invite.id, invite.organizationId)
                        }
                    >
                        {busyId === invite.id ? "Joining…" : "Accept"}
                    </Button>
                </li>
            ))}
        </ul>
    );

    if (compact) {
        return (
            <div className="px-3 py-2">
                <p className="mb-2 text-xs font-medium text-gray-500">
                    Pending invitations
                </p>
                {list}
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <AccountSection className="mb-6 space-y-3 p-4">
            <div>
                <p className="text-sm font-medium text-gray-900">
                    You have organization invitations
                </p>
                <p className="mt-1 text-xs text-gray-500">
                    No email is sent. If someone shared an invite with this
                    login, accept it here.
                </p>
            </div>
            {list}
            {error && <p className="text-sm text-red-600">{error}</p>}
        </AccountSection>
    );
}
