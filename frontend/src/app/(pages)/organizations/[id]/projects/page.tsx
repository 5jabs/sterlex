"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Shield, Users } from "lucide-react";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import { listProjects } from "@/app/lib/sterlexApi";
import type { Project } from "@/app/components/shared/types";
import { useAuth } from "@/app/contexts/AuthContext";

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function OrganizationProjectsPage() {
    const { organization } = useOrganizationSettings();
    const { user } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listProjects({ organizationId: organization.id })
            .then((rows) => {
                if (!cancelled) {
                    setProjects(rows);
                    setError(null);
                }
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
    }, [organization.id]);

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Projects
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                These are matters in {organization.name}. People only see a
                project if they own it, were added to it, or if admins can
                access all projects.
            </p>
            <AccountSection>
                {loading ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                        Loading projects…
                    </p>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-10 text-center">
                        <FolderOpen className="mb-3 h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-700">
                            No organization projects yet.
                        </p>
                        <p className="mt-1 max-w-sm text-xs text-gray-500">
                            Create a project while this organization is active
                            and it will appear here.
                        </p>
                    </div>
                ) : (
                    projects.map((project) => {
                        const people = 1 + (project.member_count ?? 0);
                        const owner =
                            project.is_owner || project.user_id === user?.id
                                ? "You"
                                : project.owner_display_name?.trim() ||
                                  "Owner";
                        return (
                            <div
                                key={project.id}
                                className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50/80"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(`/projects/${project.id}`)
                                    }
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <p className="truncate text-sm text-gray-900">
                                        {project.name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        {owner}
                                        {project.cm_number
                                            ? ` · ${project.cm_number}`
                                            : ""}
                                        {project.practice
                                            ? ` · ${project.practice}`
                                            : ""}
                                    </p>
                                </button>
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                    <Users className="h-3 w-3" />
                                    {people}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            `/projects/${project.id}/access`,
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                >
                                    <Shield className="h-3 w-3" />
                                    Access
                                </button>
                                <span className="hidden w-24 text-right text-xs text-gray-500 sm:block">
                                    {formatDate(project.created_at)}
                                </span>
                            </div>
                        );
                    })
                )}
            </AccountSection>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}
