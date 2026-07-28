import { z } from "zod";

const EnvSchema = z.object({
  PHOTON_PROJECT_ID: z.string().trim().min(1),
  PHOTON_PROJECT_SECRET: z.string().trim().min(1),
  CONVEX_URL: z.string().url(),
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.string().trim().min(1).default("openrouter/free"),
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
  openrouterApiKey: parsed.data.OPENROUTER_API_KEY,
  openrouterModel: parsed.data.OPENROUTER_MODEL,
  port: parsed.data.PORT,
} as const;
