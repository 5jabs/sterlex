"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, KeyRound, Users } from "lucide-react";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "./OrganizationSettingsContext";
import {
    getOrganizationOverview,
    type OrganizationOverview,
} from "@/app/lib/sterlexApi";
import {
    formatActivityWhen,
    organizationActivityLabel,
} from "@/app/lib/organizationActivityCopy";

function money(value: number) {
    return value.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    });
}

export default function OrganizationOverviewPage() {
    const { organization } = useOrganizationSettings();
    const router = useRouter();
    const [overview, setOverview] = useState<OrganizationOverview | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getOrganizationOverview(organization.id)
            .then((next) => {
                if (!cancelled) {
                    setOverview(next);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error).message);
            });
        return () => {
            cancelled = true;
        };
    }, [organization.id]);

    const usage = overview?.usage;

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Overview
            </h2>
            <p className="mb-6 text-sm text-gray-500">
                {organization.name} is a shared workspace. Personal projects
                stay in Personal. Matter access stays explicit unless admins
                can open every project.
            </p>

            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Members"
                    value={String(overview?.memberCount ?? "—")}
                    onClick={() =>
                        router.push(`/organizations/${organization.id}/members`)
                    }
                />
                <StatCard
                    label="Projects you can see"
                    value={String(overview?.visibleProjectCount ?? "—")}
                    onClick={() =>
                        router.push(
                            `/organizations/${organization.id}/projects`,
                        )
                    }
                />
                <StatCard
                    label="Pending invites"
                    value={String(overview?.pendingInviteCount ?? "—")}
                    onClick={() =>
                        router.push(`/organizations/${organization.id}/members`)
                    }
                />
                <StatCard
                    label="This month (est.)"
                    value={
                        usage ? money(usage.estimatedCostUsd) : "—"
                    }
                    onClick={() =>
                        router.push(`/organizations/${organization.id}/usage`)
                    }
                />
            </div>

            <AccountSection className="mb-8 space-y-3 p-4">
                <p className="text-sm font-medium text-gray-900">
                    How access works
                </p>
                <p className="text-sm text-gray-600">
                    Organization membership is not project access. Add each
                    person to the matters they should see. Owners and admins
                    can also do that from a member’s page.
                </p>
                <p className="text-sm text-gray-600">
                    {organization.admins_can_access_all_projects
                        ? "Admins can currently open every project in this organization."
                        : "Admins cannot open every project. That setting is off."}{" "}
                    {usage?.monthlyBudgetUsd == null
                        ? "There is no monthly budget cap."
                        : `Monthly budget is ${money(usage.monthlyBudgetUsd)} (${usage.budgetEnforcement}).`}
                </p>
                <p className="text-sm text-gray-600">
                    {(overview?.configuredKeyCount ?? 0) === 0
                        ? "No organization API keys are saved yet. Org projects will not fall back to personal keys."
                        : `${overview?.configuredKeyCount} organization API key${
                              (overview?.configuredKeyCount ?? 0) === 1
                                  ? ""
                                  : "s"
                          } configured.`}
                </p>
            </AccountSection>

            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-800">People</h3>
                <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-800"
                    onClick={() =>
                        router.push(`/organizations/${organization.id}/members`)
                    }
                >
                    View all
                </button>
            </div>
            <AccountSection className="mb-8">
                {(overview?.members ?? []).length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                        Loading members…
                    </p>
                ) : (
                    overview?.members.map((member) => (
                        <button
                            key={member.user_id}
                            type="button"
                            onClick={() =>
                                router.push(
                                    `/organizations/${organization.id}/members/${member.user_id}`,
                                )
                            }
                            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50/80"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                                <Users className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-gray-900">
                                    {member.display_name ||
                                        member.email ||
                                        "Member"}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                    {member.email}
                                </p>
                            </div>
                            <span className="text-xs capitalize text-gray-500">
                                {member.role}
                            </span>
                            <span className="text-xs text-gray-400">
                                {member.project_count ?? 0} projects
                            </span>
                        </button>
                    ))
                )}
            </AccountSection>

            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-800">
                    Recent activity
                </h3>
                <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-800"
                    onClick={() =>
                        router.push(
                            `/organizations/${organization.id}/activity`,
                        )
                    }
                >
                    View all
                </button>
            </div>
            <AccountSection className="mb-8">
                {(overview?.recentActivity ?? []).length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                        Member, invite, and project-access changes will appear
                        here.
                    </p>
                ) : (
                    overview?.recentActivity.map((event) => (
                        <div
                            key={event.id}
                            className="border-b border-gray-100 px-4 py-3 last:border-b-0"
                        >
                            <p className="text-sm text-gray-800">
                                {organizationActivityLabel(event)}
                            </p>
                            <p className="text-xs text-gray-500">
                                {formatActivityWhen(event.created_at)}
                            </p>
                        </div>
                    ))
                )}
            </AccountSection>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Shortcut
                    icon={Users}
                    label="Members"
                    onClick={() =>
                        router.push(`/organizations/${organization.id}/members`)
                    }
                />
                <Shortcut
                    icon={FolderOpen}
                    label="Projects"
                    onClick={() =>
                        router.push(
                            `/organizations/${organization.id}/projects`,
                        )
                    }
                />
                <Shortcut
                    icon={KeyRound}
                    label="API keys"
                    onClick={() =>
                        router.push(
                            `/organizations/${organization.id}/api-keys`,
                        )
                    }
                />
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}

function StatCard({
    label,
    value,
    onClick,
}: {
    label: string;
    value: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-xl border border-white/70 bg-white/55 px-4 py-3 text-left shadow-[0_3px_9px_rgba(15,23,42,0.03)] backdrop-blur-2xl hover:bg-white/80"
        >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-medium text-gray-900">{value}</p>
        </button>
    );
}

function Shortcut({
    icon: Icon,
    label,
    onClick,
}: {
    icon: typeof Users;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/55 px-4 py-3 text-sm text-gray-800 hover:bg-white/80"
        >
            <Icon className="h-4 w-4 text-gray-500" />
            {label}
        </button>
    );
}
