"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganization } from "@/app/contexts/OrganizationContext";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, authLoading } = useAuth();
    const { sessionHydrated, hasEnteredWorkspace } = useOrganization();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (authLoading || !sessionHydrated) return;
        if (!isAuthenticated) {
            setReady(false);
            return;
        }
        if (!hasEnteredWorkspace) {
            setReady(false);
            router.replace("/workspaces");
            return;
        }
        setReady(true);
    }, [
        authLoading,
        hasEnteredWorkspace,
        isAuthenticated,
        pathname,
        router,
        sessionHydrated,
    ]);

    if (authLoading || !sessionHydrated || !ready) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f4f2ed]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
        );
    }

    return <>{children}</>;
}
