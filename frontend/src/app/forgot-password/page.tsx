"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { SiteLogo } from "@/app/components/site-logo";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            email,
            { redirectTo },
        );
        setLoading(false);
        if (resetError) {
            setError(resetError.message);
            return;
        }
        setSent(true);
    }

    return (
        <div className="flex min-h-dvh items-start justify-center bg-gray-50/80 px-6 pb-10 pt-32">
            <div className="absolute left-1/2 top-8 -translate-x-1/2">
                <SiteLogo size="lg" asLink />
            </div>
            <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/80 p-8">
                <h1 className="font-serif text-2xl">Reset password</h1>
                {sent ? (
                    <p className="mt-4 text-sm text-gray-600">
                        If an account exists for {email}, we sent a reset link.
                        Check your inbox.
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                        <Input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@firm.com"
                        />
                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black text-white"
                        >
                            {loading ? "Sending..." : "Send reset link"}
                        </Button>
                    </form>
                )}
                <p className="mt-4 text-sm">
                    <Link href="/login" className="text-gray-600 underline">
                        Back to log in
                    </Link>
                </p>
            </div>
        </div>
    );
}
