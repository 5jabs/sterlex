"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SiteLogo } from "@/app/components/site-logo";
import { WorkspaceAvatar } from "@/app/components/organizations/WorkspaceAvatar";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { acceptPendingOrganizationInvite } from "@/app/lib/sterlexApi";
import { cn } from "@/app/lib/utils";

export function WorkspacePicker() {
    const router = useRouter();
    const { isAuthenticated, authLoading, user } = useAuth();
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

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    const personalName =
        profile?.displayName?.trim() ||
        user?.email?.split("@")[0] ||
        "Personal";

    async function enter(organizationId: string | null) {
        const key = organizationId ?? "personal";
        setEnteringId(key);
        try {
            await enterWorkspace(organizationId);
            router.push("/projects");
        } finally {
            setEnteringId(null);
        }
    }

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

    if (authLoading || !sessionHydrated || !isAuthenticated) {
        return <PickerShell />;
    }

    return (
        <PickerShell>
            <header className="mb-14 text-center md:mb-20">
                <SiteLogo size="lg" className="text-4xl md:text-5xl" />
                <h2 className="mt-10 font-serif text-3xl font-medium tracking-tight text-gray-950 md:text-5xl">
                    Where are you working?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 md:text-base">
                    Choose a workspace to enter. Personal is only yours.
                    Organizations keep the firm’s matters together.
                </p>
            </header>

            <div className="mx-auto flex w-full max-w-6xl snap-x snap-mandatory gap-8 overflow-x-auto px-2 pb-4 [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                <ProfileTile
                    name="Personal"
                    label={personalName}
                    caption="Just you"
                    delay={0}
                    active={activeOrganizationId == null}
                    busy={enteringId === "personal"}
                    onClick={() => void enter(null)}
                />
                {organizations.map((org, index) => (
                    <ProfileTile
                        key={org.id}
                        name={org.name}
                        caption={org.role}
                        delay={index + 1}
                        active={activeOrganizationId === org.id}
                        busy={enteringId === org.id}
                        onClick={() => void enter(org.id)}
                    />
                ))}
                {creating ? (
                    <CreateTile
                        name={newName}
                        onChange={setNewName}
                        onCancel={() => {
                            setCreating(false);
                            setNewName("");
                            setCreateError(null);
                        }}
                        onCreate={() => void create()}
                        busy={enteringId === "create"}
                        error={createError}
                        delay={organizations.length + 1}
                    />
                ) : (
                    <AddTile
                        delay={organizations.length + 1}
                        onClick={() => setCreating(true)}
                    />
                )}
            </div>

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
        </PickerShell>
    );
}

function PickerShell({ children }: { children?: React.ReactNode }) {
    return (
        <div className="relative min-h-dvh overflow-hidden bg-[#f4f2ed]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.9),transparent_42%),radial-gradient(circle_at_80%_100%,rgba(92,74,58,0.08),transparent_36%)]" />
            <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16 md:px-8">
                {children ?? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                )}
            </div>
        </div>
    );
}

function ProfileTile({
    name,
    label,
    caption,
    delay,
    active,
    busy,
    onClick,
}: {
    name: string;
    label?: string;
    caption: string;
    delay: number;
    active?: boolean;
    busy?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            style={{ animationDelay: `${120 + delay * 70}ms` }}
            className="workspace-tile group flex w-[7.5rem] shrink-0 snap-center flex-col items-center md:w-36"
        >
            <div
                className={cn(
                    "rounded-[1.35rem] p-[3px] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03]",
                    active
                        ? "bg-gray-900/90"
                        : "bg-transparent group-hover:bg-gray-900/15",
                )}
            >
                <WorkspaceAvatar name={name} size="lg" />
            </div>
            <span className="mt-4 max-w-full truncate text-sm font-medium text-gray-900">
                {label || name}
            </span>
            <span className="mt-0.5 text-[11px] capitalize tracking-wide text-gray-500">
                {busy ? "Entering…" : caption}
            </span>
        </button>
    );
}

function AddTile({ delay, onClick }: { delay: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ animationDelay: `${120 + delay * 70}ms` }}
            className="workspace-tile group flex w-[7.5rem] shrink-0 snap-center flex-col items-center md:w-36"
        >
            <div className="flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/30 text-gray-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-gray-500 group-hover:text-gray-700 md:h-36 md:w-36">
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

function CreateTile({
    name,
    onChange,
    onCancel,
    onCreate,
    busy,
    error,
    delay,
}: {
    name: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    onCreate: () => void;
    busy: boolean;
    error: string | null;
    delay: number;
}) {
    return (
        <div
            style={{ animationDelay: `${120 + delay * 70}ms` }}
            className="workspace-tile flex w-[7.5rem] shrink-0 snap-center flex-col items-center md:w-36"
        >
            <div className="flex h-[7.5rem] w-[7.5rem] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white/80 md:h-36 md:w-36">
                <WorkspaceAvatar
                    name={name.trim() || "New"}
                    size="lg"
                />
            </div>
            <input
                value={name}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") onCreate();
                    if (e.key === "Escape") onCancel();
                }}
                placeholder="Firm name"
                autoFocus
                disabled={busy}
                className="mt-4 w-full rounded-md border-0 bg-transparent px-1 text-center text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
            />
            <div className="mt-1 flex gap-2 text-[11px]">
                <button
                    type="button"
                    disabled={busy || !name.trim()}
                    onClick={onCreate}
                    className="text-gray-800 hover:underline disabled:text-gray-400"
                >
                    {busy ? "Creating…" : "Create"}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-600"
                >
                    Cancel
                </button>
            </div>
            {error && (
                <p className="mt-1 text-center text-[11px] text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
