"use client";

import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT_PX = 768;

export function isMobileViewport(
    breakpoint: number = MOBILE_BREAKPOINT_PX,
): boolean {
    return typeof window !== "undefined" && window.innerWidth < breakpoint;
}

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT_PX) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth < breakpoint);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [breakpoint]);

    return isMobile;
}
