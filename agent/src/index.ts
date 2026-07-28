import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

import { initializeComposioStorage, recordOutboundMessage } from "./composio.js";
import { config } from "./config.js";
import { handleMessage, type IncomingAttachment } from "./messageHandler.js";

let ready = false;
let shuttingDown = false;

const healthServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  response.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: ready ? "ok" : "starting" }));
});

healthServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Datto health endpoint listening on port ${config.port}`);
});

await initializeComposioStorage();
console.log("Datto is connected to Google Sheets and Drive through Composio");

const app = await Spectrum({
  projectId: config.spectrumProjectId,
  projectSecret: config.spectrumProjectSecret,
  providers: [imessage.config()],
});

ready = true;
console.log("Datto is connected to Photon Spectrum");

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  console.log(`Received ${signal}; shutting down Datto`);

  await app.stop().catch((error: unknown) => {
    console.error("Spectrum shutdown failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  });

  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

for await (const [space, message] of app.messages) {
  if (shuttingDown) break;
  if (message.direction === "outbound" || message.platform !== "imessage") continue;

  const spectrumUserId = message.sender?.id;
  if (!spectrumUserId) {
    console.warn("Skipping inbound message without a sender", { spectrumMessageId: message.id });
    continue;
  }

  let text: string | undefined;
  let attachment: IncomingAttachment | undefined;

  switch (message.content.type) {
    case "text":
      text = message.content.text;
      break;
    case "attachment": {
      const content = message.content;
      const kind = content.mimeType.startsWith("image/") ? "image" : "attachment";
      attachment = {
        kind,
        name: content.name,
        mimeType: content.mimeType,
        ...(content.size !== undefined ? { size: content.size } : {}),
        read: async () => new Uint8Array(await content.read()),
      };
      break;
    }
    case "voice":
      attachment = {
        kind: "voice",
        name: message.content.name ?? "voice-note",
        mimeType: message.content.mimeType,
        ...(message.content.size !== undefined ? { size: message.content.size } : {}),
      };
      break;
    default:
      continue;
  }

  try {
    await space.responding(async () => {
      const result = await handleMessage({
        spectrumMessageId: message.id,
        spectrumUserId,
        spectrumSpaceId: space.id,
        ...(text !== undefined ? { text } : {}),
        ...(attachment ? { attachment } : {}),
        createdAt: message.timestamp.getTime(),
      });

      for (const reply of result.replies) {
        const sent = await space.send(reply);
        const sentMessage = Array.isArray(sent) ? sent[0] : sent;
        await recordOutboundMessage({
          spectrumMessageId: sentMessage?.id ?? `datto-outbound-${randomUUID()}`,
          spectrumUserId,
          spectrumSpaceId: space.id,
          text: reply,
          createdAt: Date.now(),
        });
      }
    });
  } catch (error) {
    console.error("Failed to process inbound Spectrum message", {
      spectrumMessageId: message.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

await shutdown("message-stream-ended");
