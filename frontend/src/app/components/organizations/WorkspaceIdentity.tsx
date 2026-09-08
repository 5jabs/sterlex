"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { WorkspaceAvatar } from "@/app/components/organizations/WorkspaceAvatar";
import { useWorkspaceLabel } from "@/app/hooks/useWorkspaceLabel";
import { cn } from "@/app/lib/utils";

export function WorkspaceIdentity({
    collapsed = false,
    compact = false,
}: {
    collapsed?: boolean;
    compact?: boolean;
}) {
    const { hasEnteredWorkspace, leaveWorkspace, pendingInvites } =
        useOrganization();
    const { name, detail } = useWorkspaceLabel();
    const router = useRouter();

    if (!hasEnteredWorkspace) return null;

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
                </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 group-hover:bg-white group-hover:text-gray-800">
                <ArrowLeftRight className="h-3 w-3" />
                Switch
            </span>
        </button>
    );
}
