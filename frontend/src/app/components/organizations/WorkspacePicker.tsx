"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SiteLogo } from "@/app/components/site-logo";
import { WorkspaceAvatar } from "@/app/components/organizations/WorkspaceAvatar";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { personalWorkspaceName } from "@/app/lib/workspaceAppearance";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { acceptPendingOrganizationInvite } from "@/app/lib/sterlexApi";
import { cn } from "@/app/lib/utils";
import { stepPickerIndex } from "@/app/lib/workspaceScope";

export function WorkspacePicker() {
    const router = useRouter();
    const { isAuthenticated, authLoading, user, signOut } = useAuth();
    const { profile } = useUserProfile();
    const {
        organizations,
        pendingInvites,
        loading,
        sessionHydrated,
        enterWorkspace,
        createOrganization,
        reload,
        activeOrganizationId,
    } = useOrganization();
    const [enteringId, setEnteringId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteBusy, setInviteBusy] = useState<string | null>(null);
    const [focusIndex, setFocusIndex] = useState(0);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    const personalName = personalWorkspaceName(
        profile?.displayName,
        user?.email,
    );

    const tiles = useMemo(() => {
        const items: Array<{
            id: string;
            organizationId: string | null;
        }> = [
            { id: "personal", organizationId: null },
            ...organizations.map((org) => ({
                id: org.id,
                organizationId: org.id,
            })),
        ];
        if (!creating) items.push({ id: "add", organizationId: null });
        return items;
    }, [creating, organizations]);

    useEffect(() => {
        if (focusIndex >= tiles.length) setFocusIndex(0);
    }, [focusIndex, tiles.length]);

    const enter = useCallback(
        async (organizationId: string | null) => {
            const key = organizationId ?? "personal";
            setEnteringId(key);
            try {
                await enterWorkspace(organizationId);
                router.push("/projects");
            } catch {
                setEnteringId(null);
            }
        },
        [enterWorkspace, router],
    );

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (creating) return;
            if (enteringId) return;
            const target = event.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
            ) {
                return;
            }
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                setFocusIndex((index) =>
                    stepPickerIndex(index, 1, tiles.length),
                );
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                setFocusIndex((index) =>
                    stepPickerIndex(index, -1, tiles.length),
                );
            } else if (event.key === "Enter") {
                const tile = tiles[focusIndex];
                if (!tile) return;
                event.preventDefault();
                if (tile.id === "add") {
                    setCreating(true);
                    return;
                }
                void enter(tile.organizationId);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [creating, enter, enteringId, focusIndex, tiles]);

    async function create() {
        if (!newName.trim()) return;
        setCreateError(null);
        setEnteringId("create");
        try {
            const organization = await createOrganization(newName.trim());
            await enterWorkspace(organization.id);
            router.push("/projects");
        } catch (err) {
            setCreateError((err as Error).message);
            setEnteringId(null);
        }
    }

    async function acceptInvite(inviteId: string, organizationId: string) {
        setInviteBusy(inviteId);
        setInviteError(null);
        try {
            await acceptPendingOrganizationInvite(inviteId);
            await reload();
            await enterWorkspace(organizationId);
            router.push("/projects");
        } catch (err) {
            setInviteError((err as Error).message);
            setInviteBusy(null);
        }
    }

    async function handleSignOut() {
        await signOut();
        router.replace("/login");
    }

    const enteringName =
        enteringId === "personal"
            ? personalName
            : enteringId === "create"
              ? newName.trim() || "organization"
              : organizations.find((org) => org.id === enteringId)?.name;

    if (authLoading || !sessionHydrated || !isAuthenticated) {
        return <PickerShell />;
    }

    return (
        <PickerShell enteringName={enteringId ? enteringName : null}>
            <header className="mb-14 text-center md:mb-20">
                <SiteLogo size="lg" className="text-4xl md:text-5xl" />
                <h2 className="mt-10 font-serif text-3xl font-medium tracking-tight text-gray-950 md:text-5xl">
                    Who&apos;s working?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 md:text-base">
                    Choose a workspace. You&apos;ll only see its matters until
                    you switch.
                </p>
            </header>

            <div className="mx-auto flex w-full max-w-6xl snap-x snap-mandatory gap-8 overflow-x-auto px-2 pb-4 [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                <ProfileTile
                    name={personalName}
                    caption={
                        activeOrganizationId == null ? "Last used" : "Personal"
                    }
                    delay={0}
                    active={activeOrganizationId == null}
                    focused={focusIndex === 0 && !creating}
                    busy={enteringId === "personal"}
                    onClick={() => void enter(null)}
                    onFocus={() => setFocusIndex(0)}
                />
                {organizations.map((org, index) => (
                    <ProfileTile
                        key={org.id}
                        name={org.name}
                        caption={
                            activeOrganizationId === org.id
                                ? "Last used"
                                : org.role
                        }
                        delay={index + 1}
                        active={activeOrganizationId === org.id}
                        focused={focusIndex === index + 1 && !creating}
                        busy={enteringId === org.id}
                        onClick={() => void enter(org.id)}
                        onFocus={() => setFocusIndex(index + 1)}
                    />
                ))}
                {!creating && (
                    <AddTile
                        delay={organizations.length + 1}
                        focused={
                            focusIndex === organizations.length + 1 && !creating
                        }
                        onClick={() => setCreating(true)}
                        onFocus={() =>
                            setFocusIndex(organizations.length + 1)
                        }
                    />
                )}
            </div>

            {creating && (
                <form
                    className="workspace-tile mx-auto mt-10 w-full max-w-md rounded-3xl border border-white/80 bg-white/70 p-6 text-left shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void create();
                    }}
                >
                    <p className="font-serif text-xl text-gray-950">
                        New organization
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        A shared workspace for the firm&apos;s matters. You
                        become the owner.
                    </p>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setCreating(false);
                                setNewName("");
                                setCreateError(null);
                            }
                        }}
                        placeholder="Firm name"
                        autoFocus
                        disabled={enteringId === "create"}
                        className="mt-5 w-full rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
                    />
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={
                                enteringId === "create" || !newName.trim()
                            }
                            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                        >
                            {enteringId === "create"
                                ? "Creating…"
                                : "Create and enter"}
                        </button>
                        <button
                            type="button"
                            disabled={enteringId === "create"}
                            onClick={() => {
                                setCreating(false);
                                setNewName("");
                                setCreateError(null);
                            }}
                            className="text-sm text-gray-500 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                    </div>
                    {createError && (
                        <p className="mt-3 text-sm text-red-600">
                            {createError}
                        </p>
                    )}
                </form>
            )}

            {pendingInvites.length > 0 && (
                <section className="mx-auto mt-16 w-full max-w-xl text-center">
                    <p className="text-xs font-medium tracking-[0.18em] text-gray-400 uppercase">
                        Invitations
                    </p>
                    <ul className="mt-4 space-y-2">
                        {pendingInvites.map((invite) => (
                            <li
                                key={invite.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-left shadow-[0_3px_9px_rgba(15,23,42,0.04)] backdrop-blur-xl"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-gray-900">
                                        {invite.organizationName ||
                                            "Organization"}
                                    </p>
                                    <p className="text-xs capitalize text-gray-500">
                                        Join as {invite.role}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    disabled={inviteBusy !== null}
                                    onClick={() =>
                                        void acceptInvite(
                                            invite.id,
                                            invite.organizationId,
                                        )
                                    }
                                    className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-white"
                                >
                                    {inviteBusy === invite.id
                                        ? "Joining…"
                                        : "Accept"}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {inviteError && (
                        <p className="mt-3 text-sm text-red-600">
                            {inviteError}
                        </p>
                    )}
                </section>
            )}

            {loading && organizations.length === 0 && (
                <p className="mt-10 text-center text-sm text-gray-400">
                    Loading workspaces…
                </p>
            )}

            <footer className="mt-16 flex flex-col items-center gap-2 text-center">
                <p className="hidden text-[11px] tracking-wide text-gray-400 md:block">
                    Arrow keys to choose · Enter to continue
                </p>
                <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="text-xs text-gray-400 hover:text-gray-700"
                >
                    Sign out
                </button>
            </footer>
        </PickerShell>
    );
}

function PickerShell({
    children,
    enteringName,
}: {
    children?: React.ReactNode;
    enteringName?: string | null;
}) {
    return (
        <div className="relative min-h-dvh overflow-hidden bg-[#f4f2ed]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.9),transparent_42%),radial-gradient(circle_at_80%_100%,rgba(92,74,58,0.08),transparent_36%)]" />
            <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16 md:px-8">
                {children ?? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                )}
            </div>
            {enteringName ? (
                <div className="workspace-enter-overlay absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#f4f2ed]/88 backdrop-blur-md">
                    <WorkspaceAvatar name={enteringName} size="xl" />
                    <p className="mt-6 font-serif text-2xl text-gray-950">
                        Entering {enteringName}
                    </p>
                </div>
            ) : null}
        </div>
    );
}

function ProfileTile({
    name,
    caption,
    delay,
    active,
    focused,
    busy,
    onClick,
    onFocus,
}: {
    name: string;
    caption: string;
    delay: number;
    active?: boolean;
    focused?: boolean;
    busy?: boolean;
    onClick: () => void;
    onFocus: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onFocus={onFocus}
            onMouseEnter={onFocus}
            disabled={busy}
            style={{ animationDelay: `${120 + delay * 70}ms` }}
            className="workspace-tile group flex w-[7.5rem] shrink-0 snap-center flex-col items-center md:w-40"
        >
            <div
                className={cn(
                    "rounded-[1.45rem] p-[3px] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.04]",
                    active || focused
                        ? "bg-gray-900/90"
                        : "bg-transparent group-hover:bg-gray-900/15",
                )}
            >
                <WorkspaceAvatar name={name} size="lg" />
            </div>
            <span className="mt-4 max-w-full truncate text-sm font-medium text-gray-900 transition-colors group-hover:text-gray-950">
                {name}
            </span>
            <span className="mt-0.5 text-[11px] capitalize tracking-wide text-gray-500">
                {busy ? "Entering…" : caption}
            </span>
        </button>
    );
}

function AddTile({
    delay,
    focused,
    onClick,
    onFocus,
}: {
    delay: number;
    focused?: boolean;
    onClick: () => void;
    onFocus: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onFocus={onFocus}
            onMouseEnter={onFocus}
            style={{ animationDelay: `${120 + delay * 70}ms` }}
            className="workspace-tile group flex w-[7.5rem] shrink-0 snap-center flex-col items-center md:w-40"
        >
            <div
                className={cn(
                    "flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-2xl border border-dashed bg-white/30 text-gray-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:border-gray-500 group-hover:text-gray-700 md:h-36 md:w-36",
                    focused ? "border-gray-700 text-gray-700" : "border-gray-300",
                )}
            >
                <Plus className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <span className="mt-4 text-sm font-medium text-gray-700">
                Add organization
            </span>
            <span className="mt-0.5 text-[11px] text-gray-400">
                New firm workspace
            </span>
        </button>
    );
}
