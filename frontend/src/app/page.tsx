import type { Metadata } from "next";
import { HomeGate } from "./HomeGate";

export const metadata: Metadata = {
    title: "Sterlex - Enterprise legal AI. Without the enterprise price.",
    description:
        "Sterlex gives small and mid size firms the same document review, due diligence, and legal research power as the big platforms. Self service, no sales calls, live in minutes.",
};

export default function Page() {
    return <HomeGate />;
}
