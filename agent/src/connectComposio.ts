import { Composio } from "@composio/core";
import { z } from "zod";

const ConnectEnvSchema = z.object({
  COMPOSIO_API_KEY: z.string().trim().min(1),
  COMPOSIO_USER_ID: z.string().trim().min(1).default("datto-admin"),
});

const parsed = ConnectEnvSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error("Set COMPOSIO_API_KEY and optionally COMPOSIO_USER_ID before running this command");
}

const composio = new Composio({
  apiKey: parsed.data.COMPOSIO_API_KEY,
  allowTracking: false,
});

for (const toolkit of ["googlesheets", "googledrive"] as const) {
  const existing = await composio.connectedAccounts.list({
    userIds: [parsed.data.COMPOSIO_USER_ID],
    toolkitSlugs: [toolkit],
    statuses: ["ACTIVE"],
  });

  const active = existing.items[0];
  if (active) {
    console.log(`${toolkit}: already connected (${active.id})`);
    continue;
  }

  const request = await composio.toolkits.authorize(parsed.data.COMPOSIO_USER_ID, toolkit);
  console.log(`${toolkit}: ${request.redirectUrl}`);
}

console.log("Open every URL above, sign in to the Google account that owns the Datto Sheet and photo folder, then restart the agent.");
