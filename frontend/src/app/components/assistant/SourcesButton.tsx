"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { cn } from "@/app/lib/utils";

// Single home for connecting external research sources from the chat
// composer. CourtListener is the only entry today; this is also where
// per-jurisdiction sources (e.g. non-US case law) will live once added —
// no behavior for those exists yet, just this list.
export function SourcesButton({ hideLabel }: { hideLabel?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const { profile } = useUserProfile();
    const courtlistenerConfigured = !!profile?.apiKeys.courtlistener.configured;

    return (
        <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Sources"
                    title="Sources"
                    className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-white/55 hover:text-gray-700",
                        isOpen ? "bg-white/55 text-gray-700" : "",
                    )}
                >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span
                        className={hideLabel ? "hidden" : "hidden sm:inline"}
                    >
                        Sources
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-72 z-50 p-0 overflow-hidden"
                side="top"
                align="start"
            >
                <DropdownMenuLabel className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-gray-400">
                    Legal Research
                </DropdownMenuLabel>
                <DropdownMenuItem asChild className="rounded-none px-0 py-0">
                    <Link
                        href="/account/api-keys?highlight=courtlistener"
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-gray-800"
                    >
                        <span className="min-w-0">
                            <span className="block truncate">
                                CourtListener
                            </span>
                            <span className="block text-xs text-gray-400">
                                US case law
                            </span>
                        </span>
                        {courtlistenerConfigured ? (
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-green-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Connected
                            </span>
                        ) : (
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                Not connected
                            </span>
                        )}
                    </Link>
                </DropdownMenuItem>
                <div className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
                    More sources and jurisdictions coming soon.
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
