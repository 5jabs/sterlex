"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SiteLogo } from "@/app/components/site-logo";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import {
    acceptOrganizationInvite,
    getOrganizationInvite,
    type OrganizationInvitePreview,
} from "@/app/lib/sterlexApi";

export default function AcceptOrganizationInvitePage() {
    const params = useParams<{ token: string }>();
    const token = decodeURIComponent(params.token ?? "");
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const { reload, enterWorkspace } = useOrganization();
    const [invite, setInvite] = useState<OrganizationInvitePreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        if (!token || authLoading || !isAuthenticated) return;
        void getOrganizationInvite(token)
            .then(setInvite)
            .catch((err) => setError((err as Error).message));
    }, [token, authLoading, isAuthenticated]);

    async function accept() {
        setAccepting(true);
        setError(null);
        try {
            const organization = await acceptOrganizationInvite(token);
            await reload();
            await enterWorkspace(organization.id);
            router.replace("/projects");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setAccepting(false);
        }
    }

    if (authLoading) {
        return <Centered>Loading…</Centered>;
    }

    if (!isAuthenticated) {
        const next = `/organizations/invites/${encodeURIComponent(token)}`;
        return (
            <Centered>
                <SiteLogo size="lg" className="mb-6 text-3xl" asLink />
                <h1 className="font-serif text-2xl">Join an organization</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Sign in or create an account with the invited email to
                    continue.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link href={`/login?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`}>
                        <Button>Log in</Button>
                    </Link>
                    <Link href={`/signup?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`}>
                        <Button variant="outline">Sign up</Button>
                    </Link>
                </div>
            </Centered>
        );
    }

    return (
        <Centered>
            <SiteLogo size="lg" className="mb-6 text-3xl" asLink />
            <h1 className="font-serif text-2xl">
                {invite?.organizationName
                    ? `Join ${invite.organizationName}`
                    : "Organization invite"}
            </h1>
            {invite && (
                <p className="mt-2 text-sm text-gray-500">
                    Invited as {invite.role} · {invite.email}
                </p>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <Button
                className="mt-6"
                disabled={accepting || !invite || invite.status !== "pending"}
                onClick={() => void accept()}
            >
                {accepting ? "Joining…" : "Accept invite"}
            </Button>
        </Centered>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50/80 px-6 text-center">
            {children}
        </div>
    );
}
