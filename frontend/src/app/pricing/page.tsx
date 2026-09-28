import type { Metadata } from "next";
import { PricingGrid } from "@/app/components/billing/PricingGrid";
import { SiteLogo } from "@/app/components/site-logo";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Pricing — Sterlex",
    description:
        "Free to try. Personal $20/month. Enterprise $40 per seat. Buy extra tokens anytime.",
};

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-white px-6 py-12">
            <div className="mx-auto max-w-6xl">
                <div className="mb-10 flex items-center justify-between">
                    <SiteLogo size="lg" asLink />
                    <Link href="/login" className="text-sm text-gray-600">
                        Log in
                    </Link>
                </div>
                <h1 className="text-center font-serif text-4xl font-medium md:text-5xl">
                    Simple pricing. Tokens included.
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-center text-gray-500">
                    We run the models. You buy tokens. USD, self-serve, cancel in
                    Stripe whenever you want.
                </p>
                <div className="mt-12">
                    <PricingGrid />
                </div>
            </div>
        </div>
    );
}
