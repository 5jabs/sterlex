"use client";

import { useEffect, useState } from "react";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    getOrganizationUsage,
    type OrganizationUsage,
} from "@/app/lib/sterlexApi";

function money(value: number) {
    return value.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4,
    });
}

export default function OrganizationUsagePage() {
    const { organization } = useOrganizationSettings();
    const [usage, setUsage] = useState<OrganizationUsage | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void getOrganizationUsage(organization.id)
            .then(setUsage)
            .catch((err) => setError((err as Error).message));
    }, [organization.id]);

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Usage & budget
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                Internal estimates from calls the app makes with organization
                keys. This is not the OpenAI/Anthropic/Gemini invoice.
            </p>
            <AccountSection className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Stat
                        label="Estimated spend"
                        value={money(usage?.estimatedCostUsd ?? 0)}
                    />
                    <Stat
                        label="Monthly budget"
                        value={
                            usage?.monthlyBudgetUsd == null
                                ? "None"
                                : money(usage.monthlyBudgetUsd)
                        }
                    />
                    <Stat
                        label="Input tokens"
                        value={(usage?.inputTokens ?? 0).toLocaleString()}
                    />
                    <Stat
                        label="Output tokens"
                        value={(usage?.outputTokens ?? 0).toLocaleString()}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    {usage?.eventCount ?? 0} recorded events this UTC month.
                    Enforcement is {usage?.budgetEnforcement ?? organization.budget_enforcement}.
                    Token logging from LLM adapters is the next step before hard
                    caps can block requests.
                </p>
            </AccountSection>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-medium text-gray-900">{value}</p>
        </div>
    );
}
