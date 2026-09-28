"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { AccountSection } from "../AccountSection";
import {
    accountGlassPrimaryButtonClassName,
} from "../accountStyles";
import {
    getBillingSummary,
    startBillingPortal,
    startPackCheckout,
    startSubscriptionCheckout,
    updateAutoRecharge,
    type TokenLedgerEntry,
    type WalletSummary,
} from "@/app/lib/sterlexApi";

function formatTokens(value: number) {
    return value.toLocaleString();
}

export default function AccountBillingPage() {
    const [wallet, setWallet] = useState<WalletSummary | null>(null);
    const [ledger, setLedger] = useState<TokenLedgerEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    async function reload() {
        const data = await getBillingSummary();
        setWallet(data.wallet);
        setLedger(data.ledger);
    }

    useEffect(() => {
        reload().catch((err) => setError((err as Error).message));
    }, []);

    async function run(
        label: string,
        fn: () => Promise<{ url?: string } | { wallet?: WalletSummary } | void>,
    ) {
        setBusy(label);
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
            setBusy(null);
        }
    }

    const includedPct = wallet
        ? Math.min(
              100,
              wallet.includedTokensGrant === 0
                  ? 0
                  : Math.round(
                        (wallet.includedTokensRemaining /
                            wallet.includedTokensGrant) *
                            100,
                    ),
          )
        : 0;

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <h2 className="font-serif text-2xl font-medium text-gray-900">
                    Plan & tokens
                </h2>
                <p className="text-sm text-gray-500">
                    Free includes a small monthly allowance. Personal is $20/month
                    for one person. Enterprise is $40 per seat with shared tokens
                    and project permissions.
                </p>
                {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                )}
                <AccountSection className="space-y-4 p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-sm text-gray-500">Current plan</p>
                            <p className="font-serif text-2xl capitalize">
                                {wallet?.plan ?? "—"}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {wallet?.plan === "free" && (
                                <Button
                                    className={accountGlassPrimaryButtonClassName}
                                    disabled={busy !== null}
                                    onClick={() =>
                                        void run("personal", () =>
                                            startSubscriptionCheckout({
                                                plan: "personal",
                                            }),
                                        )
                                    }
                                >
                                    Upgrade to Personal — $20/mo
                                </Button>
                            )}
                            <Link
                                href="/pricing"
                                className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100"
                            >
                                Compare plans
                            </Link>
                        </div>
                    </div>
                    {wallet?.pastDue && (
                        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            Payment failed. Update your card to keep working.
                        </p>
                    )}
                    <div>
                        <div className="mb-1 flex justify-between text-xs text-gray-500">
                            <span>Included tokens remaining</span>
                            <span>
                                {formatTokens(wallet?.includedTokensRemaining ?? 0)}{" "}
                                / {formatTokens(wallet?.includedTokensGrant ?? 0)}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div
                                className="h-full bg-gray-900"
                                style={{ width: `${includedPct}%` }}
                            />
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            Prepaid packs:{" "}
                            {formatTokens(wallet?.prepaidTokens ?? 0)} tokens
                        </p>
                        <p className="text-xs text-gray-400">
                            Allowance resets{" "}
                            {wallet?.includedResetAt
                                ? new Date(wallet.includedResetAt).toLocaleDateString()
                                : "—"}
                        </p>
                    </div>
                    {wallet?.canPurchaseTokens && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                disabled={busy !== null}
                                onClick={() =>
                                    void run("pack", () =>
                                        startPackCheckout({ packs: 1 }),
                                    )
                                }
                            >
                                Buy 1M tokens — $10
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy !== null || !wallet.stripeConfigured}
                                onClick={() =>
                                    void run("portal", () => startBillingPortal())
                                }
                            >
                                Manage cards & invoices
                            </Button>
                        </div>
                    )}
                    {wallet?.canPurchaseTokens && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={wallet.autoRechargeEnabled}
                                disabled={busy !== null}
                                onChange={(event) =>
                                    void run("recharge", () =>
                                        updateAutoRecharge({
                                            enabled: event.target.checked,
                                        }),
                                    )
                                }
                            />
                            Auto-recharge a $10 pack when tokens hit zero
                        </label>
                    )}
                </AccountSection>
            </section>
            <section className="space-y-3">
                <h2 className="font-serif text-2xl font-medium text-gray-900">
                    Recent usage
                </h2>
                <AccountSection className="overflow-x-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-4 py-2">When</th>
                                <th className="px-4 py-2">Reason</th>
                                <th className="px-4 py-2">Tokens</th>
                                <th className="px-4 py-2">Model</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.length === 0 && (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-gray-400"
                                        colSpan={4}
                                    >
                                        No usage yet. Ask the assistant a question
                                        to start the meter.
                                    </td>
                                </tr>
                            )}
                            {ledger.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-t border-gray-50"
                                >
                                    <td className="px-4 py-2 text-gray-500">
                                        {new Date(row.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 capitalize">
                                        {row.reason.replace("_", " ")}
                                    </td>
                                    <td className="px-4 py-2">
                                        {row.billed_tokens.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">
                                        {row.model ?? "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </AccountSection>
            </section>
        </div>
    );
}
