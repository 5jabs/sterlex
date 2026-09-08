"use client";

import { createContext, useContext } from "react";
import type { Organization } from "@/app/lib/sterlexApi";

export const OrganizationSettingsContext = createContext<{
    organization: Organization;
    setOrganization: (organization: Organization) => void;
    reload: () => Promise<Organization>;
} | null>(null);

export function useOrganizationSettings() {
    const context = useContext(OrganizationSettingsContext);
    if (!context) {
        throw new Error(
            "useOrganizationSettings must be used within organization settings",
        );
    }
    return context;
}
