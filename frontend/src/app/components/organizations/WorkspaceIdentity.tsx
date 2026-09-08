"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { WorkspaceAvatar } from "@/app/components/organizations/WorkspaceAvatar";
import { cn } from "@/app/lib/utils";

export function WorkspaceIdentity({
    collapsed = false,
    compact = false,
}: {
    collapsed?: boolean;
    compact?: boolean;
}) {
    const {
        activeOrganization,
        hasEnteredWorkspace,
        leaveWorkspace,
        pendingInvites,
    } = useOrganization();
    const router = useRouter();

    if (!hasEnteredWorkspace) return null;

    const name = activeOrganization?.name ?? "Personal";
    const detail = activeOrganization
        ? activeOrganization.role
        : "Just you";

    function switchWorkspace() {
        leaveWorkspace();
        router.push("/workspaces");
    }

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={switchWorkspace}
                className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100"
                title={`Switch workspace · ${name}`}
                aria-label={`Switch workspace, currently ${name}`}
            >
                <WorkspaceAvatar name={name} size="sm" />
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={switchWorkspace}
            className={cn(
                "group flex w-full items-center gap-2 rounded-xl text-left transition-colors hover:bg-gray-100/80",
                compact ? "px-1 py-1" : "mx-1 mb-1 px-2 py-1.5",
            )}
            title="Switch workspace"
        >
            <WorkspaceAvatar name={name} size="sm" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-900">
                    {name}
                    {pendingInvites.length > 0 ? (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-burgundy-600 align-middle" />
                    ) : null}
                </p>
                <p className="truncate text-[11px] capitalize text-gray-500">
                    {detail}
                    <span className="text-gray-400 group-hover:text-gray-600">
                        {" "}
                        · Switch
                    </span>
                </p>
            </div>
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-gray-700" />
        </button>
    );
}
