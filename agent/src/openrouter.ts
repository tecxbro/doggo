import { z } from "zod";

import {
  AGENT_RESULT_JSON_SCHEMA,
  parseAgentResultContent,
  type AgentContext,
  type AgentResult,
} from "./agentResult.js";
import { config } from "./config.js";
import { DATTO_PROMPT } from "./prompt.js";

const OpenRouterResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

export async function generateAgentResult(context: AgentContext): Promise<AgentResult> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/tecxbro/doggo",
      "X-Title": "Datto",
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages: [
        { role: "system", content: DATTO_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "datto_agent_result",
          strict: true,
          schema: AGENT_RESULT_JSON_SCHEMA,
        },
      },
      provider: {
        require_parameters: true,
      },
      max_tokens: 500,
      temperature: 0.4,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? "unknown";
    throw new Error(`OpenRouter request failed (${response.status}; request ${requestId})`);
  }

  const completion = OpenRouterResponseSchema.parse(await response.json());
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenRouter returned no structured Datto result");
  }

  return parseAgentResultContent(content);
}

export type { AgentContext, AgentResult, ProfileExtraction } from "./agentResult.js";
