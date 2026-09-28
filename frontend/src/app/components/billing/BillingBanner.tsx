"use client";

import Link from "next/link";
import { useUserProfile } from "@/app/contexts/UserProfileContext";

export function BillingBanner() {
    const { profile } = useUserProfile();
    const wallet = profile?.wallet;
    if (!wallet) return null;
    if (wallet.pastDue) {
        return (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
                Payment failed.{" "}
                <Link href="/account/billing" className="underline">
                    Update billing
                </Link>{" "}
                to keep using Sterlex.
            </div>
        );
    }
    if (wallet.availableTokens <= 0) {
        return (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-900">
                You&apos;re out of tokens.{" "}
                <Link href="/account/billing" className="underline">
                    Upgrade or buy a pack
                </Link>
                .
            </div>
        );
    }
    if (
        wallet.includedTokensGrant > 0 &&
        wallet.includedTokensRemaining / wallet.includedTokensGrant <= 0.1
    ) {
        return (
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-center text-sm text-gray-700">
                Included tokens are running low.{" "}
                <Link href="/account/billing" className="underline">
                    Buy more
                </Link>
            </div>
        );
    }
    return null;
}
