"use client";

import { cn } from "@/app/lib/utils";
import {
    workspaceAccent,
    workspaceInitials,
} from "@/app/lib/workspaceAppearance";

export function WorkspaceAvatar({
    name,
    size = "md",
    className,
}: {
    name: string;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}) {
    const accent = workspaceAccent(name);
    const sizeClass =
        size === "sm"
            ? "h-7 w-7 text-[10px]"
            : size === "md"
              ? "h-9 w-9 text-xs"
              : size === "lg"
                ? "h-[7.5rem] w-[7.5rem] text-3xl md:h-36 md:w-36 md:text-4xl"
                : "h-40 w-40 text-4xl md:h-44 md:w-44 md:text-5xl";

    return (
        <div
            className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl font-serif font-medium tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
                size === "sm" && "rounded-md",
                size === "md" && "rounded-lg",
                sizeClass,
                className,
            )}
            style={{ background: accent.background, color: accent.color }}
            aria-hidden
        >
            {workspaceInitials(name)}
        </div>
    );
}
