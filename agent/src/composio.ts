import { Composio } from "@composio/core";
import { z } from "zod";

import type { ProfileExtraction } from "./agentResult.js";
import {
  cell,
  columnName,
  MATCH_HEADERS,
  MESSAGE_HEADERS,
  messageFromRow,
  messageToRow,
  PROFILE_HEADERS,
  profileFromRow,
  profileToRow,
  safeFileName,
  type ContentType,
  type DattoMessage,
  type DattoProfile,
  type ProfileContext,
} from "./composioData.js";
import { config } from "./config.js";

export type { ContentType, DattoMessage, DattoProfile, ProfileContext } from "./composioData.js";

const PROFILE_SHEET = "Profiles";
const MESSAGE_SHEET = "Messages";
const MATCH_SHEET = "Matches";
const PROFILE_RANGE = `${PROFILE_SHEET}!A2:V`;
const MESSAGE_RANGE = `${MESSAGE_SHEET}!A2:I`;
const SHEETS_BASE_URL = "https://sheets.googleapis.com";
const DRIVE_BASE_URL = "https://www.googleapis.com";

const SpreadsheetMetadataSchema = z
  .object({
    sheets: z
      .array(
        z
          .object({
            properties: z.object({ title: z.string().optional() }).optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const ValuesResponseSchema = z
  .object({
    values: z.array(z.array(z.unknown())).optional(),
  })
  .passthrough();

const DriveFileSchema = z
  .object({
    id: z.string().min(1),
    webViewLink: z.string().url().optional(),
  })
  .passthrough();

const composio = new Composio({
  apiKey: config.composioApiKey,
  allowTracking: false,
});

let sessionPromise: ReturnType<typeof createComposioSession> | undefined;
let initialization: Promise<void> | undefined;

async function createComposioSession() {
  const connectedAccounts: Record<string, string[]> = {};
  if (config.composioGoogleSheetsConnectionId) {
    connectedAccounts.googlesheets = [config.composioGoogleSheetsConnectionId];
  }
  if (config.composioGoogleDriveConnectionId) {
    connectedAccounts.googledrive = [config.composioGoogleDriveConnectionId];
  }

  return composio.sessions.create(config.composioUserId, {
    toolkits: ["googlesheets", "googledrive"],
    ...(Object.keys(connectedAccounts).length > 0 ? { connectedAccounts } : {}),
    sandbox: { enable: false },
  });
}

async function getSession() {
  sessionPromise ??= createComposioSession();
  return sessionPromise;
}

type ProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ProxyParameter = { name: string; value: string; in: "query" | "header" };
type ProxyRequest = {
  toolkit: "googlesheets" | "googledrive";
  endpoint: string;
  method: ProxyMethod;
  body?: Record<string, unknown>;
  binaryBody?: { base64: string; contentType: string };
  parameters?: ProxyParameter[];
};

type ProxyResponse = {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
};

async function proxyExecute(request: ProxyRequest): Promise<unknown> {
  const session = await getSession();
  const response = (await session.proxyExecute(request)) as ProxyResponse;
  if (response.status >= 200 && response.status < 300) return response.data;

  const requestId = response.headers?.["x-request-id"] ?? response.headers?.["x-composio-request-id"];
  throw new Error(
    `Composio ${request.toolkit} request failed with status ${response.status}${
      requestId ? ` (request ${requestId})` : ""
    }`,
  );
}

function parseData<T>(schema: z.ZodType<T>, data: unknown, operation: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`Composio ${operation} returned an invalid response`);
  return parsed.data;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function query(name: string, value: string): ProxyParameter {
  return { name, value, in: "query" };
}

async function getRows(range: string): Promise<unknown[][]> {
  const data = await proxyExecute({
    toolkit: "googlesheets",
    endpoint: `${SHEETS_BASE_URL}/v4/spreadsheets/${encodePathSegment(
      config.googleSpreadsheetId,
    )}/values/${encodePathSegment(range)}`,
    method: "GET",
    parameters: [query("majorDimension", "ROWS")],
  });
  return parseData(ValuesResponseSchema, data, "Sheets values read").values ?? [];
}

async function appendRow(sheetName: string, values: Array<string | number | boolean>): Promise<void> {
  await proxyExecute({
    toolkit: "googlesheets",
    endpoint: `${SHEETS_BASE_URL}/v4/spreadsheets/${encodePathSegment(
      config.googleSpreadsheetId,
    )}/values/${encodePathSegment(`${sheetName}!A:A`)}:append`,
    method: "POST",
    parameters: [query("valueInputOption", "RAW"), query("insertDataOption", "INSERT_ROWS")],
    body: {
      majorDimension: "ROWS",
      values: [values],
    },
  });
}

async function updateValues(
  range: string,
  values: Array<Array<string | number | boolean>>,
): Promise<void> {
  await proxyExecute({
    toolkit: "googlesheets",
    endpoint: `${SHEETS_BASE_URL}/v4/spreadsheets/${encodePathSegment(
      config.googleSpreadsheetId,
    )}/values/${encodePathSegment(range)}`,
    method: "PUT",
    parameters: [query("valueInputOption", "RAW")],
    body: {
      range,
      majorDimension: "ROWS",
      values,
    },
  });
}

async function updateRow(
  sheetName: string,
  rowNumber: number,
  values: Array<string | number | boolean>,
): Promise<void> {
  await updateValues(`${sheetName}!A${rowNumber}:${columnName(values.length)}${rowNumber}`, [values]);
}

async function findProfile(
  spectrumUserId: string,
): Promise<{ profile: DattoProfile; rowNumber: number } | null> {
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
  const metadataData = await proxyExecute({
    toolkit: "googlesheets",
    endpoint: `${SHEETS_BASE_URL}/v4/spreadsheets/${encodePathSegment(config.googleSpreadsheetId)}`,
    method: "GET",
    parameters: [query("fields", "sheets.properties.title")],
  });
  const metadata = parseData(SpreadsheetMetadataSchema, metadataData, "Sheets metadata read");
  const existing = new Set(
    (metadata.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === "string"),
  );

  const required = [PROFILE_SHEET, MESSAGE_SHEET, MATCH_SHEET];
  const missing = required.filter((title) => !existing.has(title));
  if (missing.length > 0) {
    await proxyExecute({
      toolkit: "googlesheets",
      endpoint: `${SHEETS_BASE_URL}/v4/spreadsheets/${encodePathSegment(
        config.googleSpreadsheetId,
      )}:batchUpdate`,
      method: "POST",
      body: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  const headerSets: Array<[string, readonly string[]]> = [
    [PROFILE_SHEET, PROFILE_HEADERS],
    [MESSAGE_SHEET, MESSAGE_HEADERS],
    [MATCH_SHEET, MATCH_HEADERS],
  ];
  for (const [sheetName, headers] of headerSets) {
    await updateValues(`${sheetName}!A1:${columnName(headers.length)}1`, [[...headers]]);
  }
}

export async function initializeComposioStorage(): Promise<void> {
  initialization ??= initialize();
  await initialization;
}

export async function getOrCreateProfile(
  spectrumUserId: string,
  spectrumSpaceId: string,
): Promise<DattoProfile> {
  await initializeComposioStorage();
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
  await initializeComposioStorage();
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
  await initializeComposioStorage();
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
  await initializeComposioStorage();
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

async function deleteDriveFile(fileId: string): Promise<void> {
  await proxyExecute({
    toolkit: "googledrive",
    endpoint: `${DRIVE_BASE_URL}/drive/v3/files/${encodePathSegment(fileId)}`,
    method: "DELETE",
    parameters: [query("supportsAllDrives", "true")],
  });
}

export async function uploadPhoto(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<{ fileId: string; url: string }> {
  await initializeComposioStorage();
  const createdData = await proxyExecute({
    toolkit: "googledrive",
    endpoint: `${DRIVE_BASE_URL}/drive/v3/files`,
    method: "POST",
    parameters: [query("supportsAllDrives", "true"), query("fields", "id")],
    body: {
      name: safeFileName(fileName),
      mimeType,
      parents: [config.googleDriveFolderId],
    },
  });
  const created = parseData(DriveFileSchema, createdData, "Drive metadata create");

  try {
    await proxyExecute({
      toolkit: "googledrive",
      endpoint: `${DRIVE_BASE_URL}/upload/drive/v3/files/${encodePathSegment(created.id)}`,
      method: "PATCH",
      parameters: [query("uploadType", "media"), query("supportsAllDrives", "true")],
      binaryBody: {
        base64: Buffer.from(bytes).toString("base64"),
        contentType: mimeType,
      },
    });

    const metadataData = await proxyExecute({
      toolkit: "googledrive",
      endpoint: `${DRIVE_BASE_URL}/drive/v3/files/${encodePathSegment(created.id)}`,
      method: "GET",
      parameters: [query("supportsAllDrives", "true"), query("fields", "id,webViewLink")],
    });
    const metadata = parseData(DriveFileSchema, metadataData, "Drive metadata read");
    return {
      fileId: metadata.id,
      url: metadata.webViewLink ?? `https://drive.google.com/file/d/${metadata.id}/view`,
    };
  } catch (error) {
    await deleteDriveFile(created.id).catch(() => undefined);
    throw error;
  }
}

export async function attachPhoto(args: {
  profileId: string;
  spectrumMessageId: string;
  fileId: string;
  url: string;
}): Promise<void> {
  await initializeComposioStorage();
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
