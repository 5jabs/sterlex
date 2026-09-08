"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
    createOrganization as createOrganizationRequest,
    listOrganizations,
    setActiveOrganization as setActiveOrganizationRequest,
    type Organization,
    type OrganizationsHome,
} from "@/app/lib/sterlexApi";

type OrganizationContextValue = {
    organizations: Organization[];
    activeOrganization: Organization | null;
    activeOrganizationId: string | null;
    pendingInvites: OrganizationsHome["pendingInvites"];
    loading: boolean;
    reload: () => Promise<void>;
    switchOrganization: (organizationId: string | null) => Promise<void>;
    createOrganization: (name: string) => Promise<Organization>;
};

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
    undefined,
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [activeOrganizationId, setActiveOrganizationId] = useState<
        string | null
    >(null);
    const [pendingInvites, setPendingInvites] = useState<
        OrganizationsHome["pendingInvites"]
    >([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        if (!isAuthenticated) {
            setOrganizations([]);
            setActiveOrganizationId(null);
            setPendingInvites([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const home = await listOrganizations();
            setOrganizations(home.organizations);
            setActiveOrganizationId(home.activeOrganizationId);
            setPendingInvites(home.pendingInvites);
        } catch {
            setOrganizations([]);
            setActiveOrganizationId(null);
            setPendingInvites([]);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (authLoading) return;
        void reload();
    }, [authLoading, reload]);

    const switchOrganization = useCallback(
        async (organizationId: string | null) => {
            const result = await setActiveOrganizationRequest(organizationId);
            setActiveOrganizationId(result.activeOrganizationId);
        },
        [],
    );

    const createOrganization = useCallback(async (name: string) => {
        const organization = await createOrganizationRequest(name);
        setOrganizations((current) => {
            const next = current.filter((item) => item.id !== organization.id);
            next.push(organization);
            next.sort((a, b) => a.name.localeCompare(b.name));
            return next;
        });
        setActiveOrganizationId(organization.id);
        return organization;
    }, []);

    const activeOrganization = useMemo(
        () =>
            organizations.find((org) => org.id === activeOrganizationId) ??
            null,
        [organizations, activeOrganizationId],
    );

    const value = useMemo(
        () => ({
            organizations,
            activeOrganization,
            activeOrganizationId,
            pendingInvites,
            loading,
            reload,
            switchOrganization,
            createOrganization,
        }),
        [
            organizations,
            activeOrganization,
            activeOrganizationId,
            pendingInvites,
            loading,
            reload,
            switchOrganization,
            createOrganization,
        ],
    );

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error("useOrganization must be used within OrganizationProvider");
    }
    return context;
}
