import { createServerSupabase } from "./supabase";
import {
    resolveModel,
    DEFAULT_TITLE_MODEL,
    DEFAULT_TABULAR_MODEL,
    OPENAI_LOW_MODELS,
    type UserApiKeys,
} from "./llm";
import {
    envApiKeys,
    getStoredUserApiKeysOnly,
} from "./userApiKeys";
import { resolveApiKeys } from "./apiKeyResolution";
import {
    getOrganizationApiKeys,
    organizationEnvFallbackAllowed,
} from "./organizationApiKeys";

export type UserModelSettings = {
    title_model: string;
    tabular_model: string;
    legal_research_us: boolean;
    api_keys: UserApiKeys;
};

export type ModelSettingsOptions = {
    organizationId?: string | null;
    projectId?: string | null;
};

// Title generation is a lightweight task — always routed to the cheapest model
// of whichever provider the user has keys for: Gemini Flash Lite if Gemini is
// available, otherwise OpenAI lite, otherwise Claude Haiku. With no user keys
// set, defaults to Gemini (the dev-mode env fallback).
function resolveTitleModel(apiKeys: UserApiKeys): string {
    if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.openai?.trim()) return OPENAI_LOW_MODELS[0];
    if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
    return DEFAULT_TITLE_MODEL;
}

async function resolveOrganizationId(
    db: ReturnType<typeof createServerSupabase>,
    options?: ModelSettingsOptions,
): Promise<string | null> {
    if (options?.organizationId) return options.organizationId;
    if (!options?.projectId) return null;
    const { data } = await db
        .from("projects")
        .select("organization_id")
        .eq("id", options.projectId)
        .maybeSingle();
    return (data?.organization_id as string | null) ?? null;
}

export async function getUserModelSettings(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
    options?: ModelSettingsOptions,
): Promise<UserModelSettings> {
    const client = db ?? createServerSupabase();
    const { data } = await client
        .from("user_profiles")
        .select("title_model, tabular_model, legal_research_us")
        .eq("user_id", userId)
        .single();
    const organizationId = await resolveOrganizationId(client, options);
    const userKeys = await getStoredUserApiKeysOnly(userId, client);
    const orgKeys = organizationId
        ? await getOrganizationApiKeys(organizationId, client)
        : {};
    const resolved = resolveApiKeys({
        context: organizationId ? "organization" : "personal",
        envKeys: envApiKeys(),
        userKeys,
        orgKeys,
        allowEnvInOrganization: organizationEnvFallbackAllowed(),
    });

    return {
        title_model: resolveModel(data?.title_model, resolveTitleModel(resolved.keys)),
        tabular_model: resolveModel(data?.tabular_model, DEFAULT_TABULAR_MODEL),
        legal_research_us:
            (data as { legal_research_us?: boolean | null } | null)
                ?.legal_research_us !== false,
        api_keys: resolved.keys,
    };
}

export async function getUserApiKeys(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
    options?: ModelSettingsOptions,
): Promise<UserApiKeys> {
    const settings = await getUserModelSettings(userId, db, options);
    return settings.api_keys;
}
