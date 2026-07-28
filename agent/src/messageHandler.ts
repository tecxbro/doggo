import {
  applyProfileExtraction,
  attachPhoto,
  getOrCreateProfile,
  getProfileAndRecentMessages,
  recordInboundMessage,
  uploadPhoto,
  type ContentType,
} from "./convex.js";
import {
  isExplicitConfirmation,
  isSupportedDogPhoto,
  MAX_PHOTO_BYTES,
  MAX_TEXT_CHARACTERS,
  missingProfileFields,
  normalizeInboundText,
  profileWouldBeComplete,
  unsupportedAttachmentReply,
} from "./messagePolicy.js";
import { generateAgentResult, type AgentResult } from "./openrouter.js";

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

function getStoredText(message: IncomingMessage, normalizedText: ReturnType<typeof normalizeInboundText>): string | undefined {
  if (normalizedText.kind === "accepted") return normalizedText.text;
  if (normalizedText.kind === "too_long") {
    return `[text omitted: exceeded ${MAX_TEXT_CHARACTERS} characters]`;
  }
  if (!message.attachment) return undefined;
  return `[${message.attachment.kind}: ${message.attachment.name}; ${message.attachment.mimeType}]`;
}

export async function handleMessage(message: IncomingMessage): Promise<AgentResult> {
  const profile = await getOrCreateProfile(message.spectrumUserId, message.spectrumSpaceId);
  const normalizedText = normalizeInboundText(message.text);
  const storedText = getStoredText(message, normalizedText);

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

  if (normalizedText.kind === "too_long") {
    return {
      replies: ["that message is longer than my leash 😭 send the important part in a shorter text?"],
      extracted: {},
      profileComplete: profile.profileComplete,
    };
  }

  let receivedImage = false;
  if (message.attachment?.kind === "image") {
    if (!isSupportedDogPhoto(message.attachment.mimeType)) {
      return {
        replies: ["send a jpg, png, heic, gif, or webp dog photo and we’re back in business"],
        extracted: {},
        profileComplete: profile.profileComplete,
      };
    }

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
      recentMessages: context.recentMessages
        .filter((recent) => recent._id !== inbound.messageId)
        .map((recent) => ({
          direction: recent.direction,
          contentType: recent.contentType,
          ...(recent.text ? { text: recent.text } : {}),
          createdAt: recent.createdAt,
        })),
      newInboundMessage:
        normalizedText.kind === "accepted"
          ? normalizedText.text
          : receivedImage
            ? "[dog photo received]"
            : "",
      inboundContainsImage: receivedImage,
      missingFields: missingProfileFields(context.profile),
    });

    const profileComplete =
      context.profile.profileComplete ||
      (result.profileComplete &&
        isExplicitConfirmation(normalizedText.kind === "accepted" ? normalizedText.text : undefined) &&
        profileWouldBeComplete(context.profile, result.extracted, receivedImage));

    await applyProfileExtraction({
      profileId: context.profile._id,
      extracted: result.extracted,
      profileComplete,
    });

    return { ...result, profileComplete };
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
