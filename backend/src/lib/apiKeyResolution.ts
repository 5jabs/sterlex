import type { UserApiKeys } from "./llm";
import type { ApiKeyProvider, ApiKeySource } from "./userApiKeys";

export type ResolvedApiKeySource = ApiKeySource | "org";

export type ResolvedApiKeys = {
    keys: UserApiKeys;
    sources: Record<ApiKeyProvider, ResolvedApiKeySource>;
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

function emptySources(): Record<ApiKeyProvider, ResolvedApiKeySource> {
    return {
        claude: null,
        gemini: null,
        openai: null,
        openrouter: null,
        courtlistener: null,
    };
}

function present(value: string | null | undefined): string | null {
    const trimmed = value?.trim() || null;
    return trimmed;
}

/**
 * Personal workspace: env keys win, then the user's BYO key.
 * Organization workspace: org keys only. Env is used only when explicitly
 * allowed, so a firm's work does not silently bill a personal or platform key.
 */
export function resolveApiKeys(args: {
    context: "personal" | "organization";
    envKeys?: Partial<UserApiKeys>;
    userKeys?: Partial<UserApiKeys>;
    orgKeys?: Partial<UserApiKeys>;
    allowEnvInOrganization?: boolean;
}): ResolvedApiKeys {
    const keys = emptyKeys();
    const sources = emptySources();
    const envKeys = args.envKeys ?? {};
    const userKeys = args.userKeys ?? {};
    const orgKeys = args.orgKeys ?? {};

    for (const provider of PROVIDERS) {
        if (args.context === "organization") {
            const org = present(orgKeys[provider]);
            if (org) {
                keys[provider] = org;
                sources[provider] = "org";
                continue;
            }
            if (args.allowEnvInOrganization) {
                const env = present(envKeys[provider]);
                if (env) {
                    keys[provider] = env;
                    sources[provider] = "env";
                }
            }
            continue;
        }

        const env = present(envKeys[provider]);
        if (env) {
            keys[provider] = env;
            sources[provider] = "env";
            continue;
        }
        const user = present(userKeys[provider]);
        if (user) {
            keys[provider] = user;
            sources[provider] = "user";
        }
    }

    return { keys, sources };
}
