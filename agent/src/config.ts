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
  COMPOSIO_API_KEY: z.string().trim().min(1),
  COMPOSIO_USER_ID: z.string().trim().min(1).default("datto-admin"),
  COMPOSIO_GOOGLE_SHEETS_CONNECTION_ID: z.string().trim().min(1).optional(),
  COMPOSIO_GOOGLE_DRIVE_CONNECTION_ID: z.string().trim().min(1).optional(),
  GOOGLE_SPREADSHEET_ID: z.string().trim().min(10),
  GOOGLE_DRIVE_FOLDER_ID: z.string().trim().min(10),
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("nvidia/nemotron-3-ultra-550b-a55b:free"),
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
  composioApiKey: parsed.data.COMPOSIO_API_KEY,
  composioUserId: parsed.data.COMPOSIO_USER_ID,
  composioGoogleSheetsConnectionId: parsed.data.COMPOSIO_GOOGLE_SHEETS_CONNECTION_ID,
  composioGoogleDriveConnectionId: parsed.data.COMPOSIO_GOOGLE_DRIVE_CONNECTION_ID,
  googleSpreadsheetId: parsed.data.GOOGLE_SPREADSHEET_ID,
  googleDriveFolderId: parsed.data.GOOGLE_DRIVE_FOLDER_ID,
  openrouterApiKey: parsed.data.OPENROUTER_API_KEY,
  openrouterModel: parsed.data.OPENROUTER_MODEL,
  port: parsed.data.PORT,
} as const;
