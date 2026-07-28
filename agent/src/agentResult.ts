import { z } from "zod";

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

export const AGENT_RESULT_JSON_SCHEMA = {
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

export function parseAgentResultContent(content: string): AgentResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid JSON");
  }

  const parsed = RawAgentResultSchema.parse(decoded);
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
