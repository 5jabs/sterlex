"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    getBillingSummary,
    startBillingPortal,
    startPackCheckout,
    startSubscriptionCheckout,
    updateAutoRecharge,
    updateEnterpriseSeats,
    type TokenLedgerEntry,
    type WalletSummary,
} from "@/app/lib/sterlexApi";

export default function OrganizationBillingPage() {
    const { organization } = useOrganizationSettings();
    const [wallet, setWallet] = useState<WalletSummary | null>(null);
    const [ledger, setLedger] = useState<TokenLedgerEntry[]>([]);
    const [seats, setSeats] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function reload() {
        const data = await getBillingSummary(organization.id);
        setWallet(data.wallet);
        setLedger(data.ledger);
        setSeats(data.wallet.seats);
    }

    useEffect(() => {
        reload().catch((err) => setError((err as Error).message));
    }, [organization.id]);

    async function withUrl(fn: () => Promise<{ url?: string } | { wallet?: WalletSummary } | { ok?: boolean }>) {
        setBusy(true);
        setError(null);
        try {
            const result = await fn();
            if (result && "url" in result && result.url) {
                window.location.href = result.url;
                return;
            }
            await reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    const subscribed =
        wallet?.subscriptionStatus === "active" ||
        wallet?.subscriptionStatus === "trialing";

    return (
        <div className="space-y-6">
            <h2 className="font-serif text-2xl font-medium text-gray-900">
                Billing
            </h2>
            <p className="text-sm text-gray-500">
                Enterprise is $40 per seat / month, self-serve. The organization
                shares one token wallet. Buy packs or auto-recharge when you run
                out.
            </p>
            {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </p>
            )}
            <AccountSection className="space-y-4 p-4">
                <p className="text-sm text-gray-500">
                    Status: {wallet?.subscriptionStatus ?? "not subscribed"}
                </p>
                <p className="text-sm">
                    Available tokens:{" "}
                    {(wallet?.availableTokens ?? 0).toLocaleString()}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm text-gray-600">
                        Seats
                        <input
                            type="number"
                            min={1}
                            className="ml-2 w-20 rounded border border-gray-200 px-2 py-1"
                            value={seats}
                            onChange={(event) =>
                                setSeats(Number(event.target.value) || 1)
                            }
                        />
                    </label>
                    {!subscribed ? (
                        <Button
                            disabled={busy}
                            onClick={() =>
                                void withUrl(() =>
                                    startSubscriptionCheckout({
                                        plan: "enterprise",
                                        organizationId: organization.id,
                                        seats,
                                    }),
                                )
                            }
                        >
                            Subscribe — ${40 * Math.max(1, seats)}/mo
                        </Button>
                    ) : (
                        <Button
                            disabled={busy}
                            onClick={() =>
                                void withUrl(() =>
                                    updateEnterpriseSeats({
                                        organizationId: organization.id,
                                        seats,
                                    }),
                                )
                            }
                        >
                            Update seats
                        </Button>
                    )}
                    {subscribed && (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                                void withUrl(() =>
                                    startPackCheckout({
                                        packs: 1,
                                        organizationId: organization.id,
                                    }),
                                )
                            }
                        >
                            Buy 1M tokens — $10
                        </Button>
                    )}
                    {wallet?.stripeConfigured && wallet.subscriptionStatus && (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                                void withUrl(() =>
                                    startBillingPortal(organization.id),
                                )
                            }
                        >
                            Stripe portal
                        </Button>
                    )}
                </div>
                {subscribed && (
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={wallet?.autoRechargeEnabled ?? false}
                            disabled={busy}
                            onChange={(event) =>
                                void withUrl(() =>
                                    updateAutoRecharge({
                                        enabled: event.target.checked,
                                        organizationId: organization.id,
                                    }),
                                )
                            }
                        />
                        Auto-recharge when the org wallet hits zero
                    </label>
                )}
            </AccountSection>
            <AccountSection className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-400">
                        <tr>
                            <th className="px-4 py-2">When</th>
                            <th className="px-4 py-2">Reason</th>
                            <th className="px-4 py-2">Tokens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledger.map((row) => (
                            <tr key={row.id} className="border-t border-gray-50">
                                <td className="px-4 py-2 text-gray-500">
                                    {new Date(row.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2">{row.reason}</td>
                                <td className="px-4 py-2">
                                    {row.billed_tokens.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </AccountSection>
        </div>
    );
}
