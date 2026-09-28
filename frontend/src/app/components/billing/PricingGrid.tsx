"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { startSubscriptionCheckout } from "@/app/lib/sterlexApi";
import { useState } from "react";

const PLANS = [
    {
        id: "free",
        name: "Free",
        price: "$0",
        detail: "Try Sterlex on a small monthly token allowance.",
        cta: "Start free",
        href: "/signup",
        features: [
            "50,000 tokens / month",
            "Assistant, projects, tabular review",
            "Platform models included",
            "No credit card",
        ],
    },
    {
        id: "personal",
        name: "Personal",
        price: "$20",
        detail: "For a single lawyer. Buy extra tokens anytime.",
        cta: "Upgrade to Personal",
        href: "/signup",
        features: [
            "2,000,000 tokens / month",
            "Buy $10 packs of 1M tokens",
            "Auto-recharge when you run out",
            "Invoices via Stripe",
        ],
    },
    {
        id: "enterprise",
        name: "Enterprise",
        price: "$40",
        detail: "Per seat. Shared wallet, orgs, and project permissions.",
        cta: "Create organization",
        href: "/workspaces",
        features: [
            "2,000,000 tokens per seat / month",
            "$40 per user, self-serve",
            "Shared org wallet + packs",
            "Invite teammates and set project access",
        ],
    },
];

export function PricingGrid() {
    const { isAuthenticated } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function checkoutPersonal() {
        setBusy(true);
        setError(null);
        try {
            const { url } = await startSubscriptionCheckout({ plan: "personal" });
            if (url) window.location.href = url;
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            {error && (
                <p className="mb-4 text-center text-sm text-red-600">{error}</p>
            )}
            <div className="grid gap-6 md:grid-cols-3">
                {PLANS.map((plan) => (
                    <div
                        key={plan.id}
                        className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                    >
                        <h3 className="font-serif text-2xl">{plan.name}</h3>
                        <p className="mt-2 text-3xl font-medium">
                            {plan.price}
                            {plan.id !== "free" && (
                                <span className="text-sm font-normal text-gray-500">
                                    {plan.id === "enterprise" ? "/seat/mo" : "/mo"}
                                </span>
                            )}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">{plan.detail}</p>
                        <ul className="mt-5 flex-1 space-y-2 text-sm text-gray-700">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        {plan.id === "personal" && isAuthenticated ? (
                            <button
                                disabled={busy}
                                onClick={() => void checkoutPersonal()}
                                className="mt-6 rounded-full bg-gray-900 px-4 py-2 text-sm text-white"
                            >
                                {plan.cta}
                            </button>
                        ) : (
                            <Link
                                href={plan.href}
                                className="mt-6 rounded-full bg-gray-900 px-4 py-2 text-center text-sm text-white"
                            >
                                {plan.cta}
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
