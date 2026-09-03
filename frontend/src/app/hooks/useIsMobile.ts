"use client";

import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT_PX = 768;

export function isMobileViewport(
    breakpoint: number = MOBILE_BREAKPOINT_PX,
): boolean {
    return typeof window !== "undefined" && window.innerWidth < breakpoint;
}

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT_PX) {
    const [isMobile, setIsMobile] = useState(() => isMobileViewport(breakpoint));

    useEffect(() => {
        const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const update = () => setIsMobile(media.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [breakpoint]);

    return isMobile;
}
