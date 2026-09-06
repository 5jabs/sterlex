"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/app/lib/utils";

export function MobileChatFab({
    onClick,
    busy = false,
    className,
}: {
    onClick: () => void;
    busy?: boolean;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Open chat"
            title="Open chat"
            className={cn(
                "flex h-14 items-center gap-2 rounded-full border border-burgundy-800/35 bg-burgundy-700/95 px-5 text-sm font-medium text-white",
                "shadow-[0_10px_28px_rgba(28,27,22,0.32),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_9px_rgba(28,27,22,0.22)]",
                "backdrop-blur-xl transition-all hover:bg-burgundy-700 active:scale-[0.98]",
                className,
            )}
        >
            <span className="relative inline-flex">
                <MessageSquare className="h-5 w-5" />
                {busy && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-burgundy-700">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/80" />
                    </span>
                )}
            </span>
            Chat
        </button>
    );
}
