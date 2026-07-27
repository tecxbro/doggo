import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function generateAgentResult(context: AgentContext): Promise<AgentResult> {
  const response = await openai.responses.parse({
    model: config.openaiModel,
    store: false,
    input: [
      { role: "system", content: DATTO_PROMPT },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
    text: {
      format: zodTextFormat(RawAgentResultSchema, "datto_agent_result"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("OpenAI returned no structured Datto result");
  }

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
    throw new Error("OpenAI returned an empty Datto reply");
  }

  return {
    replies,
    extracted,
    profileComplete: parsed.profileComplete,
  };
}
