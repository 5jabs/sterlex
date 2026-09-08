export const PERSONAL_WORKSPACE_ID = "personal";
export const WORKSPACE_SESSION_KEY = "sterlex.workspace-session";

export type WorkspaceSessionId = typeof PERSONAL_WORKSPACE_ID | (string & {});

export function isPersonalWorkspace(id: string | null | undefined) {
    return id === PERSONAL_WORKSPACE_ID;
}

export function toWorkspaceSessionId(
    organizationId: string | null | undefined,
): WorkspaceSessionId {
    return organizationId ? organizationId : PERSONAL_WORKSPACE_ID;
}

export function readWorkspaceSession(
    storage: Pick<Storage, "getItem"> | null | undefined = globalThis.sessionStorage,
): WorkspaceSessionId | null {
    if (!storage) return null;
    try {
        const value = storage.getItem(WORKSPACE_SESSION_KEY)?.trim();
        return value ? value : null;
    } catch {
        return null;
    }
}

export function writeWorkspaceSession(
    id: WorkspaceSessionId,
    storage: Pick<Storage, "setItem"> | null | undefined = globalThis.sessionStorage,
) {
    if (!storage) return;
    try {
        storage.setItem(WORKSPACE_SESSION_KEY, id);
    } catch {
        // Private mode can block sessionStorage.
    }
}

export function clearWorkspaceSession(
    storage: Pick<Storage, "removeItem"> | null | undefined = globalThis.sessionStorage,
) {
    if (!storage) return;
    try {
        storage.removeItem(WORKSPACE_SESSION_KEY);
    } catch {
        // Ignore storage failures.
    }
}

export function workspaceSessionMatchesOrg(
    sessionId: WorkspaceSessionId | null,
    organizationId: string | null,
) {
    if (!sessionId) return false;
    if (isPersonalWorkspace(sessionId)) return organizationId == null;
    return sessionId === organizationId;
}
