import { z } from "zod";

const normalizedEnvironment = {
  ...process.env,
  SPECTRUM_PROJECT_ID: process.env.SPECTRUM_PROJECT_ID ?? process.env.PHOTON_PROJECT_ID,
  SPECTRUM_PROJECT_SECRET:
    process.env.SPECTRUM_PROJECT_SECRET ?? process.env.PHOTON_PROJECT_SECRET,
};

const EnvSchema = z.object({
  SPECTRUM_PROJECT_ID: z.string().trim().min(1),
  SPECTRUM_PROJECT_SECRET: z.string().trim().min(1),
  CONVEX_URL: z.string().url(),
  AGENT_SHARED_SECRET: z.string().min(32),
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("google/gemma-4-26b-a4b-it:free"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

const parsed = EnvSchema.safeParse(normalizedEnvironment);

if (!parsed.success) {
  const invalid = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean)
    .join(", ");
  throw new Error(`Invalid environment configuration: ${invalid}`);
}

export const config = {
  spectrumProjectId: parsed.data.SPECTRUM_PROJECT_ID,
  spectrumProjectSecret: parsed.data.SPECTRUM_PROJECT_SECRET,
  convexUrl: parsed.data.CONVEX_URL,
  agentSharedSecret: parsed.data.AGENT_SHARED_SECRET,
  openrouterApiKey: parsed.data.OPENROUTER_API_KEY,
  openrouterModel: parsed.data.OPENROUTER_MODEL,
  port: parsed.data.PORT,
} as const;
