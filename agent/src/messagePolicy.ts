import type { ProfileExtraction } from "./agentResult.js";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARACTERS = 4_000;

const REQUIRED_PROFILE_FIELDS = [
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
] as const;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ProfileForPolicy = Partial<Record<(typeof REQUIRED_PROFILE_FIELDS)[number], string>> & {
  photoFileIds: string[];
};

export function normalizeInboundText(text: string | undefined):
  | { kind: "empty" }
  | { kind: "accepted"; text: string }
  | { kind: "too_long" } {
  const trimmed = text?.trim();
  if (!trimmed) return { kind: "empty" };
  if ([...trimmed].length > MAX_TEXT_CHARACTERS) return { kind: "too_long" };
  return { kind: "accepted", text: trimmed };
}

export function isSupportedDogPhoto(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

export function missingProfileFields(profile: ProfileForPolicy): string[] {
  const missing = REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value !== "string" || value.trim().length === 0;
  }).map(String);

  if (profile.photoFileIds.length === 0) missing.push("dogPhoto");
  return missing;
}

export function profileWouldBeComplete(
  profile: ProfileForPolicy,
  extracted: ProfileExtraction,
  receivedImage: boolean,
): boolean {
  const merged: ProfileForPolicy = {
    ...profile,
    ...extracted,
    photoFileIds:
      receivedImage && profile.photoFileIds.length === 0 ? ["received"] : profile.photoFileIds,
  };
  return missingProfileFields(merged).length === 0;
}

export function isExplicitConfirmation(text: string | undefined): boolean {
  const normalized = text?.trim().toLowerCase();
  if (!normalized) return false;
  return new Set(["yes", "y", "yep", "yeah", "correct", "confirmed", "looks good", "all good"]).has(
    normalized,
  );
}

export function unsupportedAttachmentReply(kind: "attachment" | "voice"): string {
  return kind === "voice"
    ? "voice notes are dramatic but i can only use texts and dog photos right now 😭 send me the important part as a text?"
    : "i can only use texts and dog photos for this little experiment. send me the dog evidence instead 🫡";
}
