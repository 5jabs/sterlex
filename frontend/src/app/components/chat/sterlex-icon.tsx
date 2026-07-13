"use client";

import React from "react";

// A small status dot: blue + pulsing/ringed while active, solid green on
// success, solid red on error, muted gray at rest. Replaces the old spinning
// pinwheel mark (a leftover "Mike" glyph) everywhere this component is used.
export function SterlexIcon({
    spin = false,
    done = false,
    error = false,
    sterlex = false,
    size = 24,
    style,
}: {
    spin?: boolean;
    done?: boolean;
    error?: boolean;
    sterlex?: boolean;
    size?: number;
    style?: React.CSSProperties;
}) {
    void sterlex;
    const dotSize = Math.max(6, Math.round(size * 0.4));
    const colorClass = error
        ? "bg-red-500"
        : done
          ? "bg-green-500"
          : spin
            ? "bg-accent-blue"
            : "bg-gray-800";

    return (
        <span
            className="relative shrink-0 inline-flex items-center justify-center"
            style={{ width: size, height: size, ...style }}
        >
            {spin && (
                <span
                    className="absolute inline-flex rounded-full bg-accent-blue opacity-50 animate-ping"
                    style={{ width: dotSize * 1.8, height: dotSize * 1.8 }}
                />
            )}
            <span
                className={`relative inline-flex rounded-full transition-colors duration-300 ${colorClass} ${
                    spin
                        ? "animate-[sterlex-pulse-dot_1.1s_ease-in-out_infinite]"
                        : ""
                }`}
                style={{ width: dotSize, height: dotSize }}
            />
        </span>
    );
}
