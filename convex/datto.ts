import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

const extractedValidator = v.object({
  ownerName: v.optional(v.string()),
  dogName: v.optional(v.string()),
  age: v.optional(v.string()),
  breed: v.optional(v.string()),
  size: v.optional(v.string()),
  gender: v.optional(v.string()),
  location: v.optional(v.string()),
  personality: v.optional(v.string()),
  energyLevel: v.optional(v.string()),
  socialBehavior: v.optional(v.string()),
  preferredMeetup: v.optional(v.string()),
  availability: v.optional(v.string()),
  dealbreakers: v.optional(v.string()),
});

const contentTypeValidator = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("attachment"),
);

function assertAgentSecret(candidate: string): void {
  const expected = process.env.AGENT_SHARED_SECRET;
  if (!expected || candidate.length !== expected.length) {
    throw new Error("Unauthorized");
  }

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  }
  if (mismatch !== 0) throw new Error("Unauthorized");
}

async function findProfile(ctx: any, spectrumUserId: string) {
  return ctx.db
    .query("profiles")
    .withIndex("by_spectrum_user_id", (q: any) => q.eq("spectrumUserId", spectrumUserId))
    .unique();
}

export const getOrCreateProfile = mutation({
  args: {
    agentSecret: v.string(),
    spectrumUserId: v.string(),
    spectrumSpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const existing = await findProfile(ctx, args.spectrumUserId);
    const now = Date.now();

    if (existing) {
      if (existing.spectrumSpaceId !== args.spectrumSpaceId) {
        await ctx.db.patch(existing._id, {
          spectrumSpaceId: args.spectrumSpaceId,
          updatedAt: now,
        });
        return { ...existing, spectrumSpaceId: args.spectrumSpaceId, updatedAt: now };
      }
      return existing;
    }

    const profileId = await ctx.db.insert("profiles", {
      spectrumUserId: args.spectrumUserId,
      spectrumSpaceId: args.spectrumSpaceId,
      photoStorageIds: [],
      profileComplete: false,
      humanStatus: "new",
      createdAt: now,
      updatedAt: now,
    });

    return ctx.db.get(profileId);
  },
});

export const getProfileAndRecentMessages = query({
  args: {
    agentSecret: v.string(),
    spectrumUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const profile = await findProfile(ctx, args.spectrumUserId);
    if (!profile) throw new Error("Profile not found");

    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));
    const newestFirst = await ctx.db
      .query("messages")
      .withIndex("by_spectrum_user_id", (q: any) => q.eq("spectrumUserId", args.spectrumUserId))
      .order("desc")
      .take(limit);

    const photoUrls = await Promise.all(
      profile.photoStorageIds.map((storageId: any) => ctx.storage.getUrl(storageId)),
    );

    return {
      profile,
      photoUrls,
      recentMessages: newestFirst.reverse(),
    };
  },
});

export const recordInboundMessage = mutation({
  args: {
    agentSecret: v.string(),
    spectrumMessageId: v.string(),
    spectrumUserId: v.string(),
    spectrumSpaceId: v.string(),
    contentType: contentTypeValidator,
    text: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_spectrum_message_id", (q: any) =>
        q.eq("spectrumMessageId", args.spectrumMessageId),
      )
      .unique();

    if (existing) return { duplicate: true, messageId: existing._id };

    const messageId = await ctx.db.insert("messages", {
      spectrumMessageId: args.spectrumMessageId,
      spectrumUserId: args.spectrumUserId,
      spectrumSpaceId: args.spectrumSpaceId,
      contentType: args.contentType,
      ...(args.text !== undefined ? { text: args.text } : {}),
      createdAt: args.createdAt,
      direction: "inbound",
    });
    return { duplicate: false, messageId };
  },
});

export const recordOutboundMessage = mutation({
  args: {
    agentSecret: v.string(),
    spectrumMessageId: v.string(),
    spectrumUserId: v.string(),
    spectrumSpaceId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_spectrum_message_id", (q: any) =>
        q.eq("spectrumMessageId", args.spectrumMessageId),
      )
      .unique();

    if (existing) return { duplicate: true, messageId: existing._id };

    const messageId = await ctx.db.insert("messages", {
      spectrumMessageId: args.spectrumMessageId,
      spectrumUserId: args.spectrumUserId,
      spectrumSpaceId: args.spectrumSpaceId,
      text: args.text,
      createdAt: args.createdAt,
      direction: "outbound",
      contentType: "text",
    });
    return { duplicate: false, messageId };
  },
});

export const applyProfileExtraction = mutation({
  args: {
    agentSecret: v.string(),
    profileId: v.id("profiles"),
    extracted: extractedValidator,
    profileComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const patch: Record<string, string | boolean | number> = {
      updatedAt: Date.now(),
      profileComplete: profile.profileComplete || args.profileComplete,
    };

    for (const [key, value] of Object.entries(args.extracted)) {
      if (typeof value === "string" && value.trim().length > 0) {
        patch[key] = value.trim();
      }
    }

    await ctx.db.patch(args.profileId, patch);
  },
});

export const generatePhotoUploadUrl = mutation({
  args: { agentSecret: v.string() },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    return ctx.storage.generateUploadUrl();
  },
});

export const attachPhoto = mutation({
  args: {
    agentSecret: v.string(),
    profileId: v.id("profiles"),
    spectrumMessageId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    assertAgentSecret(args.agentSecret);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    if (!profile.photoStorageIds.includes(args.storageId)) {
      await ctx.db.patch(args.profileId, {
        photoStorageIds: [...profile.photoStorageIds, args.storageId],
        updatedAt: Date.now(),
      });
    }

    const message = await ctx.db
      .query("messages")
      .withIndex("by_spectrum_message_id", (q: any) =>
        q.eq("spectrumMessageId", args.spectrumMessageId),
      )
      .unique();

    if (message) {
      await ctx.db.patch(message._id, {
        contentType: "image",
        storageId: args.storageId,
      });
    }
  },
});
