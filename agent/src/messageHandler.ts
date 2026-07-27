import {
  applyProfileExtraction,
  attachPhoto,
  getOrCreateProfile,
  getProfileAndRecentMessages,
  recordInboundMessage,
  uploadPhoto,
  type ContentType,
  type DattoProfile,
} from "./convex.js";
import { generateAgentResult, type AgentResult } from "./openai.js";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const PROFILE_FIELDS: Array<keyof DattoProfile> = [
  "ownerName",
  "dogName",
  "age",
  "breed",
  "size",
  "location",
  "personality",
  "energyLevel",
  "socialBehavior",
  "preferredMeetup",
  "availability",
  "dealbreakers",
];

export type IncomingAttachment = {
  kind: "image" | "attachment" | "voice";
  name: string;
  mimeType: string;
  size?: number;
  read?: () => Promise<Uint8Array>;
};

export type IncomingMessage = {
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  text?: string;
  attachment?: IncomingAttachment;
  createdAt: number;
};

function getContentType(message: IncomingMessage): ContentType {
  if (message.attachment?.kind === "image") return "image";
  if (message.attachment) return "attachment";
  return "text";
}

function getStoredText(message: IncomingMessage): string | undefined {
  const text = message.text?.trim();
  if (text) return text;
  if (!message.attachment) return undefined;
  return `[${message.attachment.kind}: ${message.attachment.name}; ${message.attachment.mimeType}]`;
}

function missingProfileFields(profile: DattoProfile): string[] {
  const missing = PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value !== "string" || value.trim().length === 0;
  });

  const fields = missing.map(String);
  if (profile.photoStorageIds.length === 0) fields.push("dogPhoto");
  return fields;
}

function unsupportedAttachmentReply(kind: "attachment" | "voice"): string {
  return kind === "voice"
    ? "voice notes are dramatic but i can only use texts and dog photos right now 😭 send me the important part as a text?"
    : "i can only use texts and dog photos for this little experiment. send me the dog evidence instead 🫡";
}

export async function handleMessage(message: IncomingMessage): Promise<AgentResult> {
  const profile = await getOrCreateProfile(message.spectrumUserId, message.spectrumSpaceId);
  const storedText = getStoredText(message);

  const inbound = await recordInboundMessage({
    spectrumMessageId: message.spectrumMessageId,
    spectrumUserId: message.spectrumUserId,
    spectrumSpaceId: message.spectrumSpaceId,
    contentType: getContentType(message),
    ...(storedText ? { text: storedText } : {}),
    createdAt: message.createdAt,
  });

  if (inbound.duplicate) {
    return { replies: [], extracted: {}, profileComplete: profile.profileComplete };
  }

  let receivedImage = false;
  if (message.attachment?.kind === "image") {
    if (
      !message.attachment.read ||
      (message.attachment.size !== undefined && message.attachment.size > MAX_PHOTO_BYTES)
    ) {
      return {
        replies: ["that photo came through a little too powerfully. send me a smaller one?"],
        extracted: {},
        profileComplete: profile.profileComplete,
      };
    }

    try {
      const bytes = await message.attachment.read();
      if (bytes.byteLength > MAX_PHOTO_BYTES) {
        return {
          replies: ["that photo is huge 😭 send me a smaller one and we’re back in business"],
          extracted: {},
          profileComplete: profile.profileComplete,
        };
      }

      const storageId = await uploadPhoto(bytes, message.attachment.mimeType);
      await attachPhoto({
        profileId: profile._id,
        spectrumMessageId: message.spectrumMessageId,
        storageId,
      });
      receivedImage = true;
    } catch (error) {
      console.error("Failed to save an inbound dog photo", {
        spectrumMessageId: message.spectrumMessageId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        replies: ["i saw the photo but my dog-photo vault fumbled it. send it one more time?"],
        extracted: {},
        profileComplete: profile.profileComplete,
      };
    }
  } else if (message.attachment) {
    return {
      replies: [unsupportedAttachmentReply(message.attachment.kind)],
      extracted: {},
      profileComplete: profile.profileComplete,
    };
  }

  const context = await getProfileAndRecentMessages(message.spectrumUserId);

  try {
    const result = await generateAgentResult({
      profile: context.profile,
      recentMessages: context.recentMessages.map((recent) => ({
        direction: recent.direction,
        contentType: recent.contentType,
        ...(recent.text ? { text: recent.text } : {}),
        createdAt: recent.createdAt,
      })),
      newInboundMessage: message.text?.trim() || (receivedImage ? "[dog photo received]" : ""),
      inboundContainsImage: receivedImage,
      missingFields: missingProfileFields(context.profile),
    });

    await applyProfileExtraction({
      profileId: context.profile._id,
      extracted: result.extracted,
      profileComplete: result.profileComplete,
    });

    return result;
  } catch (error) {
    console.error("Datto LLM processing failed", {
      spectrumMessageId: message.spectrumMessageId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      replies: ["my dog matchmaking brain just tripped over a leash. text me that again?"],
      extracted: {},
      profileComplete: context.profile.profileComplete,
    };
  }
}
