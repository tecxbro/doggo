import { z } from "zod";

const EnvSchema = z.object({
  PHOTON_PROJECT_ID: z.string().trim().min(1),
  PHOTON_PROJECT_SECRET: z.string().trim().min(1),
  CONVEX_URL: z.string().url(),
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean)
    .join(", ");
  throw new Error(`Invalid environment configuration: ${missing}`);
}

export const config = {
  photonProjectId: parsed.data.PHOTON_PROJECT_ID,
  photonProjectSecret: parsed.data.PHOTON_PROJECT_SECRET,
  convexUrl: parsed.data.CONVEX_URL,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  openaiModel: parsed.data.OPENAI_MODEL,
  port: parsed.data.PORT,
} as const;
