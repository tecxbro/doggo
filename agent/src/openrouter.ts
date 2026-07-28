import { z } from "zod";

import { config } from "./config.js";
import { DATTO_PROMPT } from "./prompt.js";

const ExtractedSchema = z.object({
  ownerName: z.string().nullable(),
  dogName: z.string().nullable(),
  age: z.string().nullable(),
  breed: z.string().nullable(),
  size: z.string().nullable(),
  gender: z.string().nullable(),
  location: z.string().nullable(),
  personality: z.string().nullable(),
  energyLevel: z.string().nullable(),
  socialBehavior: z.string().nullable(),
  preferredMeetup: z.string().nullable(),
  availability: z.string().nullable(),
  dealbreakers: z.string().nullable(),
});

const RawAgentResultSchema = z.object({
  replies: z.array(z.string()).min(1).max(2),
  extracted: ExtractedSchema,
  profileComplete: z.boolean(),
});

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

const AGENT_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    replies: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "string" },
    },
    extracted: {
      type: "object",
      additionalProperties: false,
      properties: {
        ownerName: { type: ["string", "null"] },
        dogName: { type: ["string", "null"] },
        age: { type: ["string", "null"] },
        breed: { type: ["string", "null"] },
        size: { type: ["string", "null"] },
        gender: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        personality: { type: ["string", "null"] },
        energyLevel: { type: ["string", "null"] },
        socialBehavior: { type: ["string", "null"] },
        preferredMeetup: { type: ["string", "null"] },
        availability: { type: ["string", "null"] },
        dealbreakers: { type: ["string", "null"] },
      },
      required: [
        "ownerName",
        "dogName",
        "age",
        "breed",
        "size",
        "gender",
        "location",
        "personality",
        "energyLevel",
        "socialBehavior",
        "preferredMeetup",
        "availability",
        "dealbreakers",
      ],
    },
    profileComplete: { type: "boolean" },
  },
  required: ["replies", "extracted", "profileComplete"],
} as const;

export type ProfileExtraction = Partial<{
  ownerName: string;
  dogName: string;
  age: string;
  breed: string;
  size: string;
  gender: string;
  location: string;
  personality: string;
  energyLevel: string;
  socialBehavior: string;
  preferredMeetup: string;
  availability: string;
  dealbreakers: string;
}>;

export type AgentResult = {
  replies: string[];
  extracted: ProfileExtraction;
  profileComplete: boolean;
};

export type AgentContext = {
  profile: Record<string, unknown>;
  recentMessages: Array<{
    direction: "inbound" | "outbound";
    contentType: "text" | "image" | "attachment";
    text?: string;
    createdAt: number;
  }>;
  newInboundMessage: string;
  inboundContainsImage: boolean;
  missingFields: string[];
};

export async function generateAgentResult(context: AgentContext): Promise<AgentResult> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/tecxbro/doggo",
      "X-OpenRouter-Title": "Datto",
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages: [
        { role: "system", content: DATTO_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ],
      reasoning: {
        effort: "high",
        exclude: true,
      },
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
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`OpenRouter request failed (${response.status}): ${detail}`);
  }

  const completion = OpenRouterResponseSchema.parse(await response.json());
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenRouter returned no structured Datto result");
  }

  const parsed = RawAgentResultSchema.parse(JSON.parse(content));
  const extracted = Object.fromEntries(
    Object.entries(parsed.extracted)
      .filter((entry): entry is [string, string] => {
        const value = entry[1];
        return typeof value === "string" && value.trim().length > 0;
      })
      .map(([key, value]) => [key, value.trim()]),
  ) as ProfileExtraction;

  const replies = parsed.replies.map((reply) => reply.trim()).filter(Boolean);
  if (replies.length === 0) {
    throw new Error("OpenRouter returned an empty Datto reply");
  }

  return {
    replies,
    extracted,
    profileComplete: parsed.profileComplete,
  };
}
