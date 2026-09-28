import { Resend } from "resend";
import type { PlanId } from "./billing/quotas";

let client: Resend | null | undefined;

function getResend() {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) return null;
    if (!client) client = new Resend(key);
    return client;
}

function fromAddress() {
    return process.env.RESEND_FROM_EMAIL?.trim() || "Sterlex <noreply@sterlex.ai>";
}

function appUrl(path = "") {
    const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
        /\/+$/,
        "",
    );
    return `${base}${path}`;
}

async function send(to: string, subject: string, html: string) {
    const resend = getResend();
    if (!resend || !to) return;
    try {
        await resend.emails.send({
            from: fromAddress(),
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error("[email] send failed", error);
    }
}

export async function sendWelcomeEmail(to: string) {
    await send(
        to,
        "Welcome to Sterlex",
        `<p>Your free workspace is ready.</p>
<p>Upload a contract and ask a question to see Sterlex in action. Free accounts include a small monthly token allowance so you can try the product immediately.</p>
<p><a href="${appUrl("/assistant")}">Open Sterlex</a></p>`,
    );
}

export async function sendOrganizationInviteEmail(args: {
    to: string;
    organizationName: string;
    acceptUrl: string;
}) {
    await send(
        args.to,
        `You've been invited to ${args.organizationName} on Sterlex`,
        `<p>You were invited to join <strong>${args.organizationName}</strong> on Sterlex.</p>
<p><a href="${args.acceptUrl}">Accept invitation</a></p>
<p>This link expires in 14 days.</p>`,
    );
}

export async function sendSupportCopy(args: {
    fromEmail: string;
    subject: string;
    message: string;
    type: string;
    link?: string;
}) {
    const inbox = process.env.SUPPORT_INBOX_EMAIL?.trim();
    if (!inbox) return;
    await send(
        inbox,
        `[Sterlex support] ${args.type}: ${args.subject}`,
        `<p>From: ${args.fromEmail}</p>
<p>Type: ${args.type}</p>
${args.link ? `<p>Link: ${args.link}</p>` : ""}
<p>${args.message.replace(/</g, "&lt;")}</p>`,
    );
}

export async function sendBillingEmail(args: {
    to: string;
    kind:
        | "subscription_active"
        | "pack_purchased"
        | "tokens_low"
        | "payment_failed";
    plan?: PlanId;
}) {
    const subjects: Record<typeof args.kind, string> = {
        subscription_active: "Your Sterlex subscription is active",
        pack_purchased: "Token pack purchased",
        tokens_low: "You're running low on Sterlex tokens",
        payment_failed: "Sterlex payment failed",
    };
    const bodies: Record<typeof args.kind, string> = {
        subscription_active: `<p>Your ${args.plan ?? "Sterlex"} plan is active. Manage billing anytime in Settings.</p>
<p><a href="${appUrl("/account/billing")}">View billing</a></p>`,
        pack_purchased: `<p>Your token pack was added to your wallet.</p>
<p><a href="${appUrl("/account/billing")}">View usage</a></p>`,
        tokens_low: `<p>Your included tokens are running low. Buy a pack or enable auto-recharge to avoid interruption.</p>
<p><a href="${appUrl("/account/billing")}">Buy tokens</a></p>`,
        payment_failed: `<p>We couldn't charge your card. Update your payment method to keep using Sterlex.</p>
<p><a href="${appUrl("/account/billing")}">Update billing</a></p>`,
    };
    await send(args.to, subjects[args.kind], bodies[args.kind]);
}
