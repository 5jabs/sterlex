"use client";

import { useState } from "react";
import { Building2, Check, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { cn } from "@/app/lib/utils";
import { CreateOrganizationModal } from "@/app/components/organizations/CreateOrganizationModal";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
    const {
        organizations,
        activeOrganization,
        switchOrganization,
        loading,
    } = useOrganization();
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const label = activeOrganization?.name ?? "Personal";

    async function selectWorkspace(organizationId: string | null) {
        await switchOrganization(organizationId);
        setOpen(false);
        if (pathname.startsWith("/organizations/")) {
            if (organizationId) {
                router.push(`/organizations/${organizationId}`);
            } else {
                router.push("/projects");
            }
        }
    }

    return (
        <div className="relative px-1 pb-1">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                    open ? "bg-gray-200/60" : "hover:bg-gray-100",
                )}
                title={collapsed ? label : undefined}
            >
                <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                {!collapsed && (
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                        {loading ? "Workspace" : label}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute bottom-full left-1 right-1 z-50 mb-1 rounded-xl border border-white/70 bg-white/90 p-1 shadow-[0_6px_17px_rgba(15,23,42,0.1)] backdrop-blur-xl">
                    <button
                        type="button"
                        onClick={() => void selectWorkspace(null)}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-white/70"
                    >
                        <span className="min-w-0 flex-1 truncate">Personal</span>
                        {!activeOrganization && (
                            <Check className="h-3.5 w-3.5 text-gray-700" />
                        )}
                    </button>
                    {organizations.map((org) => (
                        <button
                            key={org.id}
                            type="button"
                            onClick={() => void selectWorkspace(org.id)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-white/70"
                        >
                            <span className="min-w-0 flex-1 truncate">
                                {org.name}
                            </span>
                            {activeOrganization?.id === org.id && (
                                <Check className="h-3.5 w-3.5 text-gray-700" />
                            )}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            setCreateOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-white/70"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Create organization
                    </button>
                    {activeOrganization && (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                router.push(
                                    `/organizations/${activeOrganization.id}`,
                                );
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-white/70"
                        >
                            Organization settings
                        </button>
                    )}
                </div>
            )}
            <CreateOrganizationModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />
        </div>
    );
}
