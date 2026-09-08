import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenAI, completeOpenAIText } from "./openai";
import { providerForModel } from "./models";
import type {
    StreamChatParams,
    StreamChatResult,
    UserApiKeys,
} from "./types";
import type { LlmMetering } from "../llmUsage";
import {
    persistLlmMetering,
    assertOrganizationBudgetAllowed,
} from "../llmUsage";

export * from "./types";
export * from "./models";

export type MeteredStreamChatParams = StreamChatParams & {
    metering?: LlmMetering | null;
};

export type MeteredCompleteTextParams = {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
    metering?: LlmMetering | null;
};

async function assertMeteringBudget(metering?: LlmMetering | null) {
    if (!metering?.organizationId) return;
    await assertOrganizationBudgetAllowed(
        metering.db,
        metering.organizationId,
    );
}

export async function streamChatWithTools(
    params: MeteredStreamChatParams,
): Promise<StreamChatResult> {
    await assertMeteringBudget(params.metering);
    const provider = providerForModel(params.model);
    const result =
        provider === "claude"
            ? await streamClaude(params)
            : provider === "openai"
              ? await streamOpenAI(params)
              : await streamGemini(params);
    try {
        await persistLlmMetering(
            params.metering,
            provider,
            params.model,
            result.usage,
        );
    } catch (error) {
        console.error("[llm-usage] failed to persist stream usage", error);
    }
    return result;
}

export async function completeText(
    params: MeteredCompleteTextParams,
): Promise<string> {
    await assertMeteringBudget(params.metering);
    const provider = providerForModel(params.model);
    const result =
        provider === "claude"
            ? await completeClaudeText(params)
            : provider === "openai"
              ? await completeOpenAIText(params)
              : await completeGeminiText(params);
    try {
        await persistLlmMetering(
            params.metering,
            provider,
            params.model,
            result.usage,
        );
    } catch (error) {
        console.error("[llm-usage] failed to persist completion usage", error);
    }
    return result.text;
}
