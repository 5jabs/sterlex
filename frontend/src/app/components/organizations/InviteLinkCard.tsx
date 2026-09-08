"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { accountGlassPrimaryButtonClassName } from "@/app/(pages)/account/accountStyles";

export function InviteLinkCard({
    url,
    onDismiss,
}: {
    url: string;
    onDismiss?: () => void;
}) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="rounded-lg border border-gray-200 bg-white/70 px-3 py-3">
            <p className="text-sm font-medium text-gray-900">
                Invite link — copy and send it yourself
            </p>
            <p className="mt-1 text-xs text-gray-500">
                Sterlex does not email invitations. Share this link with the
                person you invited. Generating a new link replaces the previous
                one.
            </p>
            <p className="mt-2 break-all text-xs text-gray-700">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    className={accountGlassPrimaryButtonClassName}
                    onClick={() => void copy()}
                >
                    {copied ? "Copied" : "Copy link"}
                </Button>
                {onDismiss && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-gray-500"
                        onClick={onDismiss}
                    >
                        Dismiss
                    </Button>
                )}
            </div>
        </div>
    );
}
