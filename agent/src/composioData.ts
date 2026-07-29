export type ContentType = "text" | "image" | "attachment";
export type HumanStatus = "new" | "reviewing" | "matched" | "closed";

export type DoggoDatesProfile = {
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
  photoFileIds: string[];
  photoUrls: string[];
  profileComplete: boolean;
  humanStatus: HumanStatus;
  humanNotes?: string;
  createdAt: number;
  updatedAt: number;
};

export type DoggoDatesMessage = {
  _id: string;
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  direction: "inbound" | "outbound";
  contentType: ContentType;
  text?: string;
  driveFileId?: string;
  attachmentUrl?: string;
  createdAt: number;
};

export type ProfileContext = {
  profile: DoggoDatesProfile;
  photoUrls: string[];
  recentMessages: DoggoDatesMessage[];
};

export const PROFILE_HEADERS = [
  "spectrum_user_id",
  "spectrum_space_id",
  "owner_name",
  "dog_name",
  "age",
  "breed",
  "size",
  "gender",
  "location",
  "personality",
  "energy_level",
  "social_behavior",
  "preferred_meetup",
  "availability",
  "dealbreakers",
  "photo_file_ids",
  "photo_urls",
  "profile_complete",
  "human_status",
  "human_notes",
  "created_at",
  "updated_at",
] as const;

export const MESSAGE_HEADERS = [
  "spectrum_message_id",
  "spectrum_user_id",
  "spectrum_space_id",
  "direction",
  "content_type",
  "text",
  "drive_file_id",
  "attachment_url",
  "created_at",
] as const;

export const MATCH_HEADERS = [
  "match_id",
  "profile_a_user_id",
  "profile_b_user_id",
  "status",
  "notes",
  "created_at",
  "updated_at",
] as const;

export function columnName(columnCount: number): string {
  let value = columnCount;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function cell(row: unknown[], index: number): string {
  const value = row[index];
  return value === undefined || value === null ? "" : String(value);
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

export function parseStringArray(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseHumanStatus(value: string): HumanStatus {
  return value === "reviewing" || value === "matched" || value === "closed" ? value : "new";
}

export function profileFromRow(row: unknown[]): DoggoDatesProfile {
  const spectrumUserId = cell(row, 0).trim();
  if (!spectrumUserId) throw new Error("Google Sheets profile row is missing spectrum_user_id");

  const createdAt = parseNumber(cell(row, 20), Date.now());
  return {
    _id: spectrumUserId,
    spectrumUserId,
    spectrumSpaceId: cell(row, 1),
    ...(optional(cell(row, 2)) ? { ownerName: optional(cell(row, 2)) } : {}),
    ...(optional(cell(row, 3)) ? { dogName: optional(cell(row, 3)) } : {}),
    ...(optional(cell(row, 4)) ? { age: optional(cell(row, 4)) } : {}),
    ...(optional(cell(row, 5)) ? { breed: optional(cell(row, 5)) } : {}),
    ...(optional(cell(row, 6)) ? { size: optional(cell(row, 6)) } : {}),
    ...(optional(cell(row, 7)) ? { gender: optional(cell(row, 7)) } : {}),
    ...(optional(cell(row, 8)) ? { location: optional(cell(row, 8)) } : {}),
    ...(optional(cell(row, 9)) ? { personality: optional(cell(row, 9)) } : {}),
    ...(optional(cell(row, 10)) ? { energyLevel: optional(cell(row, 10)) } : {}),
    ...(optional(cell(row, 11)) ? { socialBehavior: optional(cell(row, 11)) } : {}),
    ...(optional(cell(row, 12)) ? { preferredMeetup: optional(cell(row, 12)) } : {}),
    ...(optional(cell(row, 13)) ? { availability: optional(cell(row, 13)) } : {}),
    ...(optional(cell(row, 14)) ? { dealbreakers: optional(cell(row, 14)) } : {}),
    photoFileIds: parseStringArray(cell(row, 15)),
    photoUrls: parseStringArray(cell(row, 16)),
    profileComplete: parseBoolean(cell(row, 17)),
    humanStatus: parseHumanStatus(cell(row, 18)),
    ...(optional(cell(row, 19)) ? { humanNotes: optional(cell(row, 19)) } : {}),
    createdAt,
    updatedAt: parseNumber(cell(row, 21), createdAt),
  };
}

export function profileToRow(profile: DoggoDatesProfile): Array<string | number | boolean> {
  return [
    profile.spectrumUserId,
    profile.spectrumSpaceId,
    profile.ownerName ?? "",
    profile.dogName ?? "",
    profile.age ?? "",
    profile.breed ?? "",
    profile.size ?? "",
    profile.gender ?? "",
    profile.location ?? "",
    profile.personality ?? "",
    profile.energyLevel ?? "",
    profile.socialBehavior ?? "",
    profile.preferredMeetup ?? "",
    profile.availability ?? "",
    profile.dealbreakers ?? "",
    JSON.stringify(profile.photoFileIds),
    JSON.stringify(profile.photoUrls),
    profile.profileComplete,
    profile.humanStatus,
    profile.humanNotes ?? "",
    profile.createdAt,
    profile.updatedAt,
  ];
}

export function messageFromRow(row: unknown[]): DoggoDatesMessage {
  const spectrumMessageId = cell(row, 0).trim();
  if (!spectrumMessageId) throw new Error("Google Sheets message row is missing spectrum_message_id");
  const direction = cell(row, 3) === "outbound" ? "outbound" : "inbound";
  const rawContentType = cell(row, 4);
  const contentType: ContentType =
    rawContentType === "image" || rawContentType === "attachment" ? rawContentType : "text";

  return {
    _id: spectrumMessageId,
    spectrumMessageId,
    spectrumUserId: cell(row, 1),
    spectrumSpaceId: cell(row, 2),
    direction,
    contentType,
    ...(optional(cell(row, 5)) ? { text: optional(cell(row, 5)) } : {}),
    ...(optional(cell(row, 6)) ? { driveFileId: optional(cell(row, 6)) } : {}),
    ...(optional(cell(row, 7)) ? { attachmentUrl: optional(cell(row, 7)) } : {}),
    createdAt: parseNumber(cell(row, 8), Date.now()),
  };
}

export function messageToRow(message: DoggoDatesMessage): Array<string | number> {
  return [
    message.spectrumMessageId,
    message.spectrumUserId,
    message.spectrumSpaceId,
    message.direction,
    message.contentType,
    message.text ?? "",
    message.driveFileId ?? "",
    message.attachmentUrl ?? "",
    message.createdAt,
  ];
}

export function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim();
  return cleaned || `doggodates-photo-${Date.now()}`;
}
