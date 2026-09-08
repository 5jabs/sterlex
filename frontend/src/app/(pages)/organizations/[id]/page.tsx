"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { AccountToggle } from "@/app/(pages)/account/AccountToggle";
import {
    accountGlassDangerOutlineButtonClassName,
    accountGlassInputClassName,
    accountGlassPrimaryButtonClassName,
} from "@/app/(pages)/account/accountStyles";
import { ConfirmPopup } from "@/app/components/popups/ConfirmPopup";
import { useOrganization } from "@/app/contexts/OrganizationContext";
import { useOrganizationSettings } from "./OrganizationSettingsContext";
import {
    deleteOrganization,
    updateOrganization,
    type BudgetEnforcement,
} from "@/app/lib/sterlexApi";

const canManage = (role: string) => role === "owner" || role === "admin";

export default function OrganizationGeneralPage() {
    const { organization, setOrganization } = useOrganizationSettings();
    const { reload, switchOrganization } = useOrganization();
    const router = useRouter();
    const [name, setName] = useState(organization.name);
    const [budget, setBudget] = useState(
        organization.monthly_budget_usd == null
            ? ""
            : String(organization.monthly_budget_usd),
    );
    const [enforcement, setEnforcement] = useState<BudgetEnforcement>(
        organization.budget_enforcement,
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const manage = canManage(organization.role);

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const updated = await updateOrganization(organization.id, {
                name,
                monthlyBudgetUsd: budget.trim() ? Number(budget) : null,
                budgetEnforcement: enforcement,
            });
            setOrganization(updated);
            await reload();
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    }

    async function toggleAdminAccess(checked: boolean) {
        try {
            const updated = await updateOrganization(organization.id, {
                adminsCanAccessAllProjects: checked,
            });
            setOrganization(updated);
            await reload();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    async function handleDelete() {
        try {
            await deleteOrganization(organization.id);
            await switchOrganization(null);
            await reload();
            router.push("/projects");
        } catch (err) {
            setError((err as Error).message);
            setDeleteOpen(false);
        }
    }

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                General
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                Organization settings apply to everyone in this workspace. Your
                personal projects stay separate.
            </p>
            <AccountSection className="space-y-5 p-4">
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Name
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!manage}
                        className={accountGlassInputClassName}
                    />
                </div>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-700">
                            Admins can access all projects
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                            Off by default so matter confidentiality is preserved.
                            Project access stays explicit unless you turn this on.
                        </p>
                    </div>
                    <AccountToggle
                        checked={organization.admins_can_access_all_projects}
                        disabled={!manage}
                        onChange={(checked) => void toggleAdminAccess(checked)}
                    />
                </div>
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Monthly budget (USD estimate)
                    </label>
                    <Input
                        type="number"
                        min="0"
                        step="1"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        disabled={!manage}
                        placeholder="No cap"
                        className={accountGlassInputClassName}
                    />
                </div>
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Budget enforcement
                    </label>
                    <select
                        value={enforcement}
                        onChange={(e) =>
                            setEnforcement(e.target.value as BudgetEnforcement)
                        }
                        disabled={!manage}
                        className={`${accountGlassInputClassName} h-10 w-full`}
                    >
                        <option value="off">Off — track only</option>
                        <option value="soft">Soft — warn when over budget</option>
                        <option value="hard">Hard — block new LLM calls</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                        Estimates use tokens recorded from app LLM calls, not
                        the provider invoice. Soft warns on the usage page;
                        hard returns HTTP 402 and blocks new calls.
                    </p>
                </div>
                {manage && (
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            className={accountGlassPrimaryButtonClassName}
                            onClick={() => void save()}
                            disabled={saving || !name.trim()}
                        >
                            {saving ? "Saving…" : saved ? "Saved" : "Save"}
                        </Button>
                    </div>
                )}
            </AccountSection>

            {organization.role === "owner" && (
                <AccountSection className="mt-8 p-4">
                    <h3 className="text-sm font-medium text-gray-900">
                        Delete organization
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Projects in this organization must be moved or deleted
                        first.
                    </p>
                    <Button
                        type="button"
                        className={`${accountGlassDangerOutlineButtonClassName} mt-4`}
                        onClick={() => setDeleteOpen(true)}
                    >
                        Delete organization
                    </Button>
                </AccountSection>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <ConfirmPopup
                open={deleteOpen}
                title="Delete this organization?"
                message="This cannot be undone. Members will lose access immediately."
                confirmLabel="Delete"
                onCancel={() => setDeleteOpen(false)}
                onConfirm={() => void handleDelete()}
            />
        </div>
    );
}
