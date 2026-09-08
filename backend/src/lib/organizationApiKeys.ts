import { createServerSupabase } from "./supabase";
import type { UserApiKeys } from "./llm";
import {
    decryptStoredApiKey,
    encryptStoredApiKey,
    type EncryptedApiKeyRow,
} from "./encryptedApiKeys";
import {
    envApiKeys,
    hasEnvApiKey,
    normalizeApiKeyProvider,
    type ApiKeyProvider,
    type ApiKeySource,
    type ApiKeyStatus,
} from "./userApiKeys";

type Db = ReturnType<typeof createServerSupabase>;

type EncryptedKeyRow = EncryptedApiKeyRow & {
    provider: ApiKeyProvider;
};

const PROVIDERS: ApiKeyProvider[] = [
    "claude",
    "gemini",
    "openai",
    "openrouter",
    "courtlistener",
];

function emptyKeys(): UserApiKeys {
    return {
        claude: null,
        gemini: null,
        openai: null,
        openrouter: null,
        courtlistener: null,
    };
}

export async function getOrganizationApiKeys(
    organizationId: string,
    db: Db = createServerSupabase(),
): Promise<UserApiKeys> {
    const apiKeys = emptyKeys();
    const { data, error } = await db
        .from("organization_api_keys")
        .select("provider, encrypted_key, iv, auth_tag")
        .eq("organization_id", organizationId);
    if (error) throw error;

    for (const row of (data ?? []) as EncryptedKeyRow[]) {
        const provider = normalizeApiKeyProvider(row.provider);
        if (!provider) continue;
        apiKeys[provider] = decryptStoredApiKey(row);
    }
    return apiKeys;
}

export async function getOrganizationApiKeyStatus(
    organizationId: string,
    db: Db = createServerSupabase(),
): Promise<ApiKeyStatus> {
    const status: ApiKeyStatus = {
        claude: false,
        gemini: false,
        openai: false,
        openrouter: false,
        courtlistener: false,
        sources: {
            claude: null,
            gemini: null,
            openai: null,
            openrouter: null,
            courtlistener: null,
        },
    };

    const { data, error } = await db
        .from("organization_api_keys")
        .select("provider")
        .eq("organization_id", organizationId);
    if (error) throw error;

    for (const row of data ?? []) {
        const provider = normalizeApiKeyProvider(String(row.provider));
        if (!provider) continue;
        status[provider] = true;
        status.sources[provider] = "org";
    }

    return status;
}

export async function saveOrganizationApiKey(
    organizationId: string,
    provider: ApiKeyProvider,
    value: string | null,
    db: Db = createServerSupabase(),
): Promise<void> {
    if (hasEnvApiKey(provider) && process.env.ORG_API_KEYS_ALLOW_ENV === "true") {
        // Status still reports org keys independently of env; saving is allowed.
    }
    const normalized = value?.trim() || null;
    if (!normalized) {
        const { error } = await db
            .from("organization_api_keys")
            .delete()
            .eq("organization_id", organizationId)
            .eq("provider", provider);
        if (error) throw error;
        return;
    }

    const { error } = await db.from("organization_api_keys").upsert(
        {
            organization_id: organizationId,
            provider,
            ...encryptStoredApiKey(normalized),
            updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" },
    );
    if (error) throw error;
}

export function organizationEnvFallbackAllowed(): boolean {
    return process.env.ORG_API_KEYS_ALLOW_ENV === "true";
}

export { envApiKeys };
