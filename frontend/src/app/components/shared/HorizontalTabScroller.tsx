import type { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

/** Horizontal tab row on small screens, stacked column from md up. */
export function HorizontalTabScroller({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("relative min-w-0", className)}>
            <div className="-mx-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible">
                <div className="flex w-max min-w-full flex-nowrap md:block md:w-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
