import type Stripe from "stripe";
import type { createServerSupabase } from "../supabase";
import { getStripe } from "./stripe";
import {
    loadWalletForCustomer,
    markCanceled,
    rememberPaymentMethod,
    upsertSubscriptionRecord,
} from "./stripe";
import { TOKEN_PACK_TOKENS, isPlanId } from "./quotas";
import { creditPrepaid, getWalletById } from "./wallet";
import { sendBillingEmail } from "../email";

type Db = ReturnType<typeof createServerSupabase>;

async function alreadyProcessed(db: Db, eventId: string) {
    const { data } = await db
        .from("billing_stripe_events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();
    return !!data;
}

async function markProcessed(db: Db, event: Stripe.Event) {
    await db.from("billing_stripe_events").insert({
        id: event.id,
        type: event.type,
    });
}

async function walletFromMetadata(
    db: Db,
    metadata: Stripe.Metadata | null | undefined,
    customerId?: string | null,
) {
    if (metadata?.wallet_id) {
        return getWalletById(db, metadata.wallet_id);
    }
    if (customerId) return loadWalletForCustomer(db, customerId);
    return null;
}

export function constructStripeEvent(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

export async function handleStripeEvent(db: Db, event: Stripe.Event) {
    if (await alreadyProcessed(db, event.id)) return;
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const wallet = await walletFromMetadata(
                db,
                session.metadata,
                typeof session.customer === "string" ? session.customer : null,
            );
            if (!wallet) break;
            if (session.mode === "subscription" && session.subscription) {
                const sub = await getStripe().subscriptions.retrieve(
                    String(session.subscription),
                );
                const plan = isPlanId(session.metadata?.plan)
                    ? session.metadata.plan
                    : wallet.plan;
                await upsertSubscriptionRecord(db, {
                    wallet,
                    subscription: sub,
                    plan: plan === "free" ? "personal" : plan,
                    stripeEventId: event.id,
                });
            }
            if (session.mode === "payment" && session.metadata?.kind === "token_pack") {
                const packs = Math.max(1, Number(session.metadata.packs) || 1);
                await creditPrepaid(db, wallet.id, TOKEN_PACK_TOKENS * packs, {
                    reason: "pack_purchase",
                    userId: session.metadata.user_id,
                    stripeEventId: event.id,
                    metadata: { packs },
                });
                const email = session.customer_details?.email;
                if (email) {
                    await sendBillingEmail({
                        to: email,
                        kind: "pack_purchased",
                    });
                }
            }
            const pm =
                typeof session.payment_intent === "object" &&
                session.payment_intent &&
                "payment_method" in session.payment_intent
                    ? String(
                          (session.payment_intent as Stripe.PaymentIntent)
                              .payment_method ?? "",
                      )
                    : null;
            if (typeof session.customer === "string") {
                await rememberPaymentMethod(
                    db,
                    wallet.id,
                    session.customer,
                    pm || undefined,
                );
            }
            break;
        }
        case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice & {
                subscription?: string | Stripe.Subscription | null;
            };
            const subscriptionId =
                typeof invoice.subscription === "string"
                    ? invoice.subscription
                    : invoice.subscription?.id;
            if (!subscriptionId) break;
            const sub = await getStripe().subscriptions.retrieve(subscriptionId);
            const wallet = await walletFromMetadata(
                db,
                sub.metadata,
                typeof invoice.customer === "string" ? invoice.customer : null,
            );
            if (!wallet) break;
            const plan = isPlanId(sub.metadata?.plan)
                ? sub.metadata.plan
                : wallet.plan;
            await upsertSubscriptionRecord(db, {
                wallet,
                subscription: sub,
                plan: plan === "free" ? wallet.plan : plan,
                stripeEventId: event.id,
            });
            break;
        }
        case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const wallet = await loadWalletForCustomer(
                db,
                String(invoice.customer),
            );
            if (!wallet) break;
            await db
                .from("wallets")
                .update({
                    past_due: true,
                    subscription_status: "past_due",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", wallet.id);
            if (invoice.customer_email) {
                await sendBillingEmail({
                    to: invoice.customer_email,
                    kind: "payment_failed",
                });
            }
            break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const wallet = await walletFromMetadata(
                db,
                sub.metadata,
                typeof sub.customer === "string" ? sub.customer : null,
            );
            if (!wallet) break;
            if (event.type === "customer.subscription.deleted") {
                await markCanceled(db, wallet);
            } else {
                const plan = isPlanId(sub.metadata?.plan)
                    ? sub.metadata.plan
                    : wallet.plan;
                await upsertSubscriptionRecord(db, {
                    wallet,
                    subscription: sub,
                    plan: plan === "free" ? wallet.plan : plan,
                    stripeEventId: event.id,
                });
            }
            break;
        }
        default:
            break;
    }
    await markProcessed(db, event);
}
