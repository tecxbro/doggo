import { Readable } from "node:stream";

import { google } from "googleapis";

import type { ProfileExtraction } from "./agentResult.js";
import { config } from "./config.js";

export type ContentType = "text" | "image" | "attachment";
export type HumanStatus = "new" | "reviewing" | "matched" | "closed";

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
  photoFileIds: string[];
  photoUrls: string[];
  profileComplete: boolean;
  humanStatus: HumanStatus;
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
  driveFileId?: string;
  attachmentUrl?: string;
  createdAt: number;
};

export type ProfileContext = {
  profile: DattoProfile;
  photoUrls: string[];
  recentMessages: DattoMessage[];
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

const PROFILE_SHEET = "Profiles";
const MESSAGE_SHEET = "Messages";
const MATCH_SHEET = "Matches";
const PROFILE_RANGE = `${PROFILE_SHEET}!A2:V`;
const MESSAGE_RANGE = `${MESSAGE_SHEET}!A2:I`;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: config.googleServiceAccountEmail,
    private_key: config.googlePrivateKey,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });
let initialization: Promise<void> | undefined;

function columnName(columnCount: number): string {
  let value = columnCount;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cell(row: unknown[], index: number): string {
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

function parseStringArray(value: string): string[] {
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

function profileFromRow(row: unknown[]): DattoProfile {
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

function profileToRow(profile: DattoProfile): Array<string | number | boolean> {
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

function messageFromRow(row: unknown[]): DattoMessage {
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

function messageToRow(message: DattoMessage): Array<string | number> {
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

async function getRows(range: string): Promise<unknown[][]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSpreadsheetId,
    range,
  });
  return response.data.values ?? [];
}

async function appendRow(sheetName: string, values: Array<string | number | boolean>): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSpreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function updateRow(
  sheetName: string,
  rowNumber: number,
  values: Array<string | number | boolean>,
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSpreadsheetId,
    range: `${sheetName}!A${rowNumber}:${columnName(values.length)}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function findProfile(spectrumUserId: string): Promise<{ profile: DattoProfile; rowNumber: number } | null> {
  const rows = await getRows(PROFILE_RANGE);
  const index = rows.findIndex((row) => cell(row, 0) === spectrumUserId);
  return index === -1 ? null : { profile: profileFromRow(rows[index] ?? []), rowNumber: index + 2 };
}

async function findMessage(
  spectrumMessageId: string,
): Promise<{ message: DattoMessage; rowNumber: number } | null> {
  const rows = await getRows(MESSAGE_RANGE);
  const index = rows.findIndex((row) => cell(row, 0) === spectrumMessageId);
  return index === -1 ? null : { message: messageFromRow(rows[index] ?? []), rowNumber: index + 2 };
}

async function initialize(): Promise<void> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSpreadsheetId,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    (metadata.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === "string"),
  );

  const required = [PROFILE_SHEET, MESSAGE_SHEET, MATCH_SHEET];
  const missing = required.filter((title) => !existing.has(title));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleSpreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  const headerSets: Array<[string, readonly string[]]> = [
    [PROFILE_SHEET, PROFILE_HEADERS],
    [MESSAGE_SHEET, MESSAGE_HEADERS],
    [MATCH_SHEET, MATCH_HEADERS],
  ];
  await Promise.all(
    headerSets.map(([sheetName, headers]) =>
      sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSpreadsheetId,
        range: `${sheetName}!A1:${columnName(headers.length)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...headers]] },
      }),
    ),
  );
}

export async function initializeGoogleStorage(): Promise<void> {
  initialization ??= initialize();
  await initialization;
}

export async function getOrCreateProfile(
  spectrumUserId: string,
  spectrumSpaceId: string,
): Promise<DattoProfile> {
  await initializeGoogleStorage();
  const existing = await findProfile(spectrumUserId);
  const now = Date.now();

  if (existing) {
    if (existing.profile.spectrumSpaceId !== spectrumSpaceId) {
      const updated = { ...existing.profile, spectrumSpaceId, updatedAt: now };
      await updateRow(PROFILE_SHEET, existing.rowNumber, profileToRow(updated));
      return updated;
    }
    return existing.profile;
  }

  const profile: DattoProfile = {
    _id: spectrumUserId,
    spectrumUserId,
    spectrumSpaceId,
    photoFileIds: [],
    photoUrls: [],
    profileComplete: false,
    humanStatus: "new",
    createdAt: now,
    updatedAt: now,
  };
  await appendRow(PROFILE_SHEET, profileToRow(profile));
  return profile;
}

export async function getProfileAndRecentMessages(
  spectrumUserId: string,
): Promise<ProfileContext> {
  await initializeGoogleStorage();
  const profileResult = await findProfile(spectrumUserId);
  if (!profileResult) throw new Error("Profile not found");

  const recentMessages = (await getRows(MESSAGE_RANGE))
    .filter((row) => cell(row, 1) === spectrumUserId)
    .map(messageFromRow)
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-20);

  return {
    profile: profileResult.profile,
    photoUrls: profileResult.profile.photoUrls,
    recentMessages,
  };
}

async function recordMessage(message: DattoMessage): Promise<{ duplicate: boolean; messageId: string }> {
  await initializeGoogleStorage();
  const existing = await findMessage(message.spectrumMessageId);
  if (existing) return { duplicate: true, messageId: existing.message._id };
  await appendRow(MESSAGE_SHEET, messageToRow(message));
  return { duplicate: false, messageId: message._id };
}

export async function recordInboundMessage(args: {
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  contentType: ContentType;
  text?: string;
  createdAt: number;
}): Promise<{ duplicate: boolean; messageId: string }> {
  return recordMessage({
    _id: args.spectrumMessageId,
    spectrumMessageId: args.spectrumMessageId,
    spectrumUserId: args.spectrumUserId,
    spectrumSpaceId: args.spectrumSpaceId,
    direction: "inbound",
    contentType: args.contentType,
    ...(args.text !== undefined ? { text: args.text } : {}),
    createdAt: args.createdAt,
  });
}

export async function recordOutboundMessage(args: {
  spectrumMessageId: string;
  spectrumUserId: string;
  spectrumSpaceId: string;
  text: string;
  createdAt: number;
}): Promise<{ duplicate: boolean; messageId: string }> {
  return recordMessage({
    _id: args.spectrumMessageId,
    spectrumMessageId: args.spectrumMessageId,
    spectrumUserId: args.spectrumUserId,
    spectrumSpaceId: args.spectrumSpaceId,
    direction: "outbound",
    contentType: "text",
    text: args.text,
    createdAt: args.createdAt,
  });
}

const PROFILE_EXTRACTION_FIELDS: Array<keyof ProfileExtraction> = [
  "ownerName",
  "dogName",
  "age",
  "breed",
  "size",
  "gender",
  "location",
  "personality",
  "energyLevel",
  "socialBehavior",
  "preferredMeetup",
  "availability",
  "dealbreakers",
];

export async function applyProfileExtraction(args: {
  profileId: string;
  extracted: ProfileExtraction;
  profileComplete: boolean;
}): Promise<void> {
  await initializeGoogleStorage();
  const found = await findProfile(args.profileId);
  if (!found) throw new Error("Profile not found");

  const updated: DattoProfile = {
    ...found.profile,
    profileComplete: found.profile.profileComplete || args.profileComplete,
    updatedAt: Date.now(),
  };
  for (const field of PROFILE_EXTRACTION_FIELDS) {
    const value = args.extracted[field];
    if (typeof value === "string" && value.trim()) {
      Object.assign(updated, { [field]: value.trim() });
    }
  }

  await updateRow(PROFILE_SHEET, found.rowNumber, profileToRow(updated));
}

function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim();
  return cleaned || `dog-photo-${Date.now()}`;
}

export async function uploadPhoto(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<{ fileId: string; url: string }> {
  await initializeGoogleStorage();
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: safeFileName(fileName),
      parents: [config.googleDriveFolderId],
    },
    media: {
      mimeType,
      body: Readable.from([Buffer.from(bytes)]),
    },
    fields: "id,webViewLink",
  });

  const fileId = response.data.id;
  if (!fileId) throw new Error("Google Drive returned no file ID");
  return {
    fileId,
    url: response.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}

export async function attachPhoto(args: {
  profileId: string;
  spectrumMessageId: string;
  fileId: string;
  url: string;
}): Promise<void> {
  await initializeGoogleStorage();
  const profileResult = await findProfile(args.profileId);
  if (!profileResult) throw new Error("Profile not found");

  const updatedProfile: DattoProfile = {
    ...profileResult.profile,
    photoFileIds: profileResult.profile.photoFileIds.includes(args.fileId)
      ? profileResult.profile.photoFileIds
      : [...profileResult.profile.photoFileIds, args.fileId],
    photoUrls: profileResult.profile.photoUrls.includes(args.url)
      ? profileResult.profile.photoUrls
      : [...profileResult.profile.photoUrls, args.url],
    updatedAt: Date.now(),
  };
  await updateRow(PROFILE_SHEET, profileResult.rowNumber, profileToRow(updatedProfile));

  const messageResult = await findMessage(args.spectrumMessageId);
  if (messageResult) {
    const updatedMessage: DattoMessage = {
      ...messageResult.message,
      contentType: "image",
      driveFileId: args.fileId,
      attachmentUrl: args.url,
    };
    await updateRow(MESSAGE_SHEET, messageResult.rowNumber, messageToRow(updatedMessage));
  }
}
