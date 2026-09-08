"use client";

import { useEffect, useState } from "react";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    getOrganizationApiKeyStatus,
    isMfaRequiredError,
    saveOrganizationApiKey,
    type ApiKeyProvider,
    type ApiKeyStatus,
} from "@/app/lib/sterlexApi";
import {
    MfaVerificationPopup,
    needsMfaVerification,
} from "@/app/components/popups/MfaVerificationPopup";
import { Input } from "@/app/components/ui/input";
import { accountGlassInputClassName } from "@/app/(pages)/account/accountStyles";

const FIELDS: Array<{ provider: ApiKeyProvider; label: string; placeholder: string }> = [
    { provider: "claude", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
    { provider: "gemini", label: "Google (Gemini)", placeholder: "AI..." },
    { provider: "openai", label: "OpenAI", placeholder: "sk-..." },
    { provider: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
    { provider: "courtlistener", label: "CourtListener", placeholder: "Token..." },
];

export default function OrganizationApiKeysPage() {
    const { organization } = useOrganizationSettings();
    const [status, setStatus] = useState<ApiKeyStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const canManage =
        organization.role === "owner" || organization.role === "admin";

    useEffect(() => {
        void getOrganizationApiKeyStatus(organization.id)
            .then(setStatus)
            .catch((err) => setError((err as Error).message));
    }, [organization.id]);

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Organization API keys
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                These keys are used for organization projects. Personal keys are
                not used for firm work, so client data stays on the
                organization&apos;s provider account.
            </p>
            <AccountSection>
                {FIELDS.map((field, index) => (
                    <div key={field.provider}>
                        <OrgKeyField
                            label={field.label}
                            placeholder={field.placeholder}
                            configured={!!status?.[field.provider]}
                            canManage={canManage}
                            onSave={async (value) => {
                                const next = await saveOrganizationApiKey(
                                    organization.id,
                                    field.provider,
                                    value,
                                );
                                setStatus(next);
                            }}
                        />
                        {index < FIELDS.length - 1 && (
                            <div className="mx-4 h-px bg-gray-200" />
                        )}
                    </div>
                ))}
            </AccountSection>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}

function OrgKeyField({
    label,
    placeholder,
    configured,
    canManage,
    onSave,
}: {
    label: string;
    placeholder: string;
    configured: boolean;
    canManage: boolean;
    onSave: (value: string | null) => Promise<void>;
}) {
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [pendingMfa, setPendingMfa] = useState<"save" | "remove" | null>(null);

    async function run(next: string | null) {
        setSaving(true);
        try {
            if (await needsMfaVerification()) {
                setPendingMfa(next ? "save" : "remove");
                return;
            }
            await onSave(next);
            setValue("");
        } catch (error) {
            if (isMfaRequiredError(error)) {
                setPendingMfa(next ? "save" : "remove");
            } else {
                alert((error as Error).message);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="px-4 py-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
                {label}
            </label>
            <p className="mb-3 text-xs text-gray-500">
                {configured ? "Configured" : "Not configured"}
            </p>
            {canManage && (
                <div className="flex flex-col gap-2">
                    <Input
                        type="password"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={configured ? "Saved key hidden" : placeholder}
                        className={accountGlassInputClassName}
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            disabled={saving || !value.trim()}
                            onClick={() => void run(value.trim())}
                            className="text-xs font-medium text-gray-700 hover:text-gray-950 disabled:text-gray-400"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                        {configured && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void run(null)}
                                className="text-xs font-medium text-red-600"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            )}
            <MfaVerificationPopup
                open={!!pendingMfa}
                onCancel={() => setPendingMfa(null)}
                onVerified={() => {
                    const action = pendingMfa;
                    setPendingMfa(null);
                    if (action === "save") void run(value.trim());
                    if (action === "remove") void run(null);
                }}
            />
        </div>
    );
}
