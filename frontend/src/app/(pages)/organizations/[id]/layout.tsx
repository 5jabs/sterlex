"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getOrganization, type Organization } from "@/app/lib/sterlexApi";
import { accountTabButtonClassName } from "@/app/(pages)/account/accountStyles";
import { OrganizationSettingsContext } from "./OrganizationSettingsContext";

export default function OrganizationSettingsLayout({
    params,
    children,
}: {
    params: Promise<{ id: string }>;
    children: ReactNode;
}) {
    const { id } = use(params);
    const router = useRouter();
    const pathname = usePathname();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getOrganization(id)
            .then((org) => {
                if (!cancelled) {
                    setOrganization(org);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setOrganization(null);
                    setError((err as Error).message || "Organization not found");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id]);

    const tabs = organization
        ? [
              { href: `/organizations/${organization.id}`, label: "General" },
              {
                  href: `/organizations/${organization.id}/members`,
                  label: "Members",
              },
              {
                  href: `/organizations/${organization.id}/projects`,
                  label: "Projects",
              },
              {
                  href: `/organizations/${organization.id}/api-keys`,
                  label: "API Keys",
              },
              {
                  href: `/organizations/${organization.id}/usage`,
                  label: "Usage",
              },
          ]
        : [];

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="mx-auto max-w-xl px-6 py-16 text-center">
                <h1 className="font-serif text-2xl">Organization not found</h1>
                <p className="mt-2 text-sm text-gray-500">{error}</p>
            </div>
        );
    }

    return (
        <OrganizationSettingsContext.Provider
            value={{
                organization,
                setOrganization,
                reload: async () => {
                    const next = await getOrganization(id);
                    setOrganization(next);
                    return next;
                },
            }}
        >
            <div className="flex h-full flex-col overflow-y-auto">
                <header className="mx-auto flex h-14 w-full max-w-5xl shrink-0 items-end px-4 pb-2 md:h-24 md:px-6 md:pb-4">
                    <h1 className="font-serif text-3xl font-medium md:text-4xl">
                        {organization.name}
                    </h1>
                </header>
                <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:pt-6">
                    <div className="grid grid-cols-1 gap-y-6 md:grid-cols-[224px_minmax(0,1fr)] md:gap-x-10">
                        <nav
                            aria-label="Organization"
                            className="z-10 -ml-3 min-w-0 self-start md:sticky md:top-4"
                        >
                            <ul className="mb-0 flex gap-1 md:flex-col">
                                {tabs.map((tab) => {
                                    const active =
                                        pathname === tab.href ||
                                        (tab.href.endsWith("/members") &&
                                            pathname.endsWith("/members")) ||
                                        (tab.href.endsWith("/projects") &&
                                            pathname.endsWith("/projects")) ||
                                        (tab.href.endsWith("/api-keys") &&
                                            pathname.endsWith("/api-keys")) ||
                                        (tab.href.endsWith("/usage") &&
                                            pathname.endsWith("/usage"));
                                    const generalActive =
                                        pathname ===
                                        `/organizations/${organization.id}`;
                                    const isActive = tab.label === "General"
                                        ? generalActive
                                        : active && tab.label !== "General";
                                    return (
                                        <li key={tab.href}>
                                            <button
                                                type="button"
                                                aria-current={
                                                    isActive ? "page" : undefined
                                                }
                                                onClick={() =>
                                                    router.push(tab.href)
                                                }
                                                className={accountTabButtonClassName(
                                                    isActive,
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                        <div className="min-w-0 outline-none">{children}</div>
                    </div>
                </main>
            </div>
        </OrganizationSettingsContext.Provider>
    );
}
