"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { personalWorkspaceName } from "@/app/lib/workspaceAppearance";
import { PERSONAL_WORKSPACE_ID } from "@/app/lib/workspaceSession";

export function useWorkspaceLabel() {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const { enteredWorkspaceId, organizations } = useOrganization();

    const personalName = personalWorkspaceName(
        profile?.displayName,
        user?.email,
    );
    const isPersonal =
        !enteredWorkspaceId || enteredWorkspaceId === PERSONAL_WORKSPACE_ID;
    const organization = isPersonal
        ? null
        : (organizations.find((org) => org.id === enteredWorkspaceId) ?? null);

    return {
        personalName,
        isPersonal,
        organization,
        name: organization?.name ?? personalName,
        detail: organization ? organization.role : "Personal",
    };
}
