import crypto from "crypto";

export type EncryptedApiKeyRow = {
    encrypted_key: string;
    iv: string;
    auth_tag: string;
};

function encryptionKey(): Buffer {
    const secret = process.env.USER_API_KEYS_ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error("USER_API_KEYS_ENCRYPTION_SECRET is not configured");
    }
    return crypto.scryptSync(secret, "sterlex-user-api-keys-v1", 32);
}

export function encryptStoredApiKey(value: string): EncryptedApiKeyRow {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    return {
        encrypted_key: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        auth_tag: cipher.getAuthTag().toString("base64"),
    };
}

export function decryptStoredApiKey(
    row: EncryptedApiKeyRow & { provider?: string },
): string | null {
    try {
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            encryptionKey(),
            Buffer.from(row.iv, "base64"),
        );
        decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(row.encrypted_key, "base64")),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    } catch (err) {
        console.error("[api-keys] failed to decrypt stored key", {
            provider: row.provider ?? null,
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
