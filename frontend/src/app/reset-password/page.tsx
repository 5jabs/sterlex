"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { SiteLogo } from "@/app/components/site-logo";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({
            password,
        });
        setLoading(false);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        router.replace("/assistant");
    }

    return (
        <div className="flex min-h-dvh items-start justify-center bg-gray-50/80 px-6 pb-10 pt-32">
            <div className="absolute left-1/2 top-8 -translate-x-1/2">
                <SiteLogo size="lg" asLink />
            </div>
            <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/80 p-8">
                <h1 className="font-serif text-2xl">Choose a new password</h1>
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <Input
                        type="password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="New password"
                    />
                    <Input
                        type="password"
                        required
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        placeholder="Confirm password"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-black text-white"
                    >
                        {loading ? "Saving..." : "Update password"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
