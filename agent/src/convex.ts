import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { z } from "zod";

import type { ProfileExtraction } from "./agentResult.js";
import { config } from "./config.js";

const client = new ConvexHttpClient(config.convexUrl);
const datto = (anyApi as any).datto;
const authenticated = { agentSecret: config.agentSharedSecret } as const;

export type ContentType = "text" | "image" | "attachment";

export type DattoProfile = {
  _id: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  ownerName?: string;
  dogName?: string;
  age?: string;
  breed?: string;
  size?: string;
  gender?: string;
  location?: string;
  personality?: string;
  energyLevel?: string;
  socialBehavior?: string;
  preferredMeetup?: string;
  availability?: string;
  dealbreakers?: string;
  photoStorageIds: string[];
  profileComplete: boolean;
  humanStatus: "new" | "reviewing" | "matched" | "closed";
  humanNotes?: string;
  createdAt: number;
  updatedAt: number;
};

export type DattoMessage = {
  _id: string;
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  direction: "inbound" | "outbound";
  contentType: ContentType;
  text?: string;
  storageId?: string;
  createdAt: number;
};

export type ProfileContext = {
  profile: DattoProfile;
  photoUrls: Array<string | null>;
  recentMessages: DattoMessage[];
};

export async function getOrCreateProfile(
  spectrumUserId: string,
  spectrumSpaceId: string,
): Promise<DattoProfile> {
  return client.mutation(datto.getOrCreateProfile, {
    ...authenticated,
    spectrumUserId,
    spectrumSpaceId,
  }) as Promise<DattoProfile>;
}

export async function getProfileAndRecentMessages(
  spectrumUserId: string,
): Promise<ProfileContext> {
  return client.query(datto.getProfileAndRecentMessages, {
    ...authenticated,
    spectrumUserId,
    limit: 20,
  }) as Promise<ProfileContext>;
}

export async function recordInboundMessage(args: {
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  contentType: ContentType;
  text?: string;
  createdAt: number;
}): Promise<{ duplicate: boolean; messageId: string }> {
  return client.mutation(datto.recordInboundMessage, {
    ...authenticated,
    ...args,
  }) as Promise<{
    duplicate: boolean;
    messageId: string;
  }>;
}

export async function recordOutboundMessage(args: {
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  text: string;
  createdAt: number;
}): Promise<{ duplicate: boolean; messageId: string }> {
  return client.mutation(datto.recordOutboundMessage, {
    ...authenticated,
    ...args,
  }) as Promise<{
    duplicate: boolean;
    messageId: string;
  }>;
}

export async function applyProfileExtraction(args: {
  profileId: string;
  extracted: ProfileExtraction;
  profileComplete: boolean;
}): Promise<void> {
  await client.mutation(datto.applyProfileExtraction, {
    ...authenticated,
    ...args,
  });
}

export async function uploadPhoto(bytes: Uint8Array, mimeType: string): Promise<string> {
  const uploadUrl = (await client.mutation(datto.generatePhotoUploadUrl, authenticated)) as string;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: Buffer.from(bytes),
  });

  if (!response.ok) {
    throw new Error(`Convex photo upload failed with status ${response.status}`);
  }

  const result = z.object({ storageId: z.string().min(1) }).parse(await response.json());
  return result.storageId;
}

export async function attachPhoto(args: {
  profileId: string;
  spectrumMessageId: string;
  storageId: string;
}): Promise<void> {
  await client.mutation(datto.attachPhoto, {
    ...authenticated,
    ...args,
  });
}
