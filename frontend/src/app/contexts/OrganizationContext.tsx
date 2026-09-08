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
import {
    PERSONAL_WORKSPACE_ID,
    clearWorkspaceSession,
    readWorkspaceSession,
    toWorkspaceSessionId,
    writeWorkspaceSession,
    type WorkspaceSessionId,
} from "@/app/lib/workspaceSession";

type OrganizationContextValue = {
    organizations: Organization[];
    activeOrganization: Organization | null;
    activeOrganizationId: string | null;
    pendingInvites: OrganizationsHome["pendingInvites"];
    loading: boolean;
    sessionHydrated: boolean;
    hasEnteredWorkspace: boolean;
    enteredWorkspaceId: WorkspaceSessionId | null;
    enteredOrganization: Organization | null;
    reload: () => Promise<void>;
    switchOrganization: (organizationId: string | null) => Promise<void>;
    createOrganization: (name: string) => Promise<Organization>;
    enterWorkspace: (organizationId: string | null) => Promise<void>;
    leaveWorkspace: () => void;
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
    const [enteredWorkspaceId, setEnteredWorkspaceId] =
        useState<WorkspaceSessionId | null>(null);
    const [sessionHydrated, setSessionHydrated] = useState(false);

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

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            clearWorkspaceSession();
            setEnteredWorkspaceId(null);
            setSessionHydrated(true);
            return;
        }
        setEnteredWorkspaceId(readWorkspaceSession());
        setSessionHydrated(true);
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        if (!sessionHydrated || !enteredWorkspaceId || loading) return;
        if (enteredWorkspaceId === PERSONAL_WORKSPACE_ID) return;
        const stillMember = organizations.some(
            (org) => org.id === enteredWorkspaceId,
        );
        if (!stillMember) {
            clearWorkspaceSession();
            setEnteredWorkspaceId(null);
        }
    }, [enteredWorkspaceId, loading, organizations, sessionHydrated]);

    const switchOrganization = useCallback(
        async (organizationId: string | null) => {
            const result = await setActiveOrganizationRequest(organizationId);
            setActiveOrganizationId(result.activeOrganizationId);
        },
        [],
    );

    const enterWorkspace = useCallback(
        async (organizationId: string | null) => {
            await switchOrganization(organizationId);
            const sessionId = toWorkspaceSessionId(organizationId);
            writeWorkspaceSession(sessionId);
            setEnteredWorkspaceId(sessionId);
        },
        [switchOrganization],
    );

    const leaveWorkspace = useCallback(() => {
        clearWorkspaceSession();
        setEnteredWorkspaceId(null);
    }, []);

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

    const enteredOrganization = useMemo(() => {
        if (
            !enteredWorkspaceId ||
            enteredWorkspaceId === PERSONAL_WORKSPACE_ID
        ) {
            return null;
        }
        return (
            organizations.find((org) => org.id === enteredWorkspaceId) ?? null
        );
    }, [enteredWorkspaceId, organizations]);

    const value = useMemo(
        () => ({
            organizations,
            activeOrganization,
            activeOrganizationId,
            pendingInvites,
            loading,
            sessionHydrated,
            hasEnteredWorkspace: enteredWorkspaceId !== null,
            enteredWorkspaceId,
            enteredOrganization,
            reload,
            switchOrganization,
            createOrganization,
            enterWorkspace,
            leaveWorkspace,
        }),
        [
            organizations,
            activeOrganization,
            activeOrganizationId,
            pendingInvites,
            loading,
            sessionHydrated,
            enteredWorkspaceId,
            enteredOrganization,
            reload,
            switchOrganization,
            createOrganization,
            enterWorkspace,
            leaveWorkspace,
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
