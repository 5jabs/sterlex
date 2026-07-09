export type NotConnectedProvider = "claude" | "gemini" | "openai" | "courtlistener";

// "missing": no key configured at all (neither user key nor env fallback).
// "invalid": a key exists but the provider rejected it (401/403).
export type NotConnectedReason = "missing" | "invalid";

// Thrown by an LLM adapter's apiKey() resolver or by the CourtListener
// client when no usable key is available. Distinct from a generic Error so
// the chat stream can stop the turn (or pause and ask) and point the user at
// the API-keys settings page, instead of letting the model retry or answer
// around a silently failed tool call.
export class NotConnectedError extends Error {
    provider: NotConnectedProvider;
    reason: NotConnectedReason;

    constructor(
        provider: NotConnectedProvider,
        message: string,
        reason: NotConnectedReason = "missing",
    ) {
        super(message);
        this.name = "NotConnectedError";
        this.provider = provider;
        this.reason = reason;
    }
}
