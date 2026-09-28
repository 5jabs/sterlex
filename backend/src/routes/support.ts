import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { sendSupportCopy } from "../lib/email";

export const supportRouter = Router();

supportRouter.post("/", requireAuth, async (req, res) => {
    const email = (res.locals.userEmail as string) || "";
    const type =
        typeof req.body?.type === "string" ? req.body.type : "question";
    const subject =
        typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const link = typeof req.body?.link === "string" ? req.body.link.trim() : "";
    if (!subject || !message) {
        return void res.status(400).json({ detail: "subject and message are required" });
    }
    const db = createServerSupabase();
    const { error } = await db.from("contact_messages").insert({
        name: email,
        email,
        subject,
        message,
        source: "in-app-support",
        user_agent: req.get("user-agent") ?? null,
    });
    if (error) {
        return void res.status(500).json({ detail: error.message });
    }
    await sendSupportCopy({
        fromEmail: email,
        subject,
        message,
        type,
        link,
    });
    res.json({ ok: true });
});
