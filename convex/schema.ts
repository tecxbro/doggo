import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    spectrumUserId: v.string(),
    spectrumSpaceId: v.string(),
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
    photoStorageIds: v.array(v.id("_storage")),
    profileComplete: v.boolean(),
    humanStatus: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("matched"),
      v.literal("closed"),
    ),
    humanNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_spectrum_user_id", ["spectrumUserId"]),

  messages: defineTable({
    spectrumMessageId: v.string(),
    spectrumUserId: v.string(),
    spectrumSpaceId: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    contentType: v.union(v.literal("text"), v.literal("image"), v.literal("attachment")),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_spectrum_message_id", ["spectrumMessageId"])
    .index("by_spectrum_user_id", ["spectrumUserId"]),

  matches: defineTable({
    profileAId: v.id("profiles"),
    profileBId: v.id("profiles"),
    status: v.union(
      v.literal("draft"),
      v.literal("introduced"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("done"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
