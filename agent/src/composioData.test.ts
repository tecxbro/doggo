import assert from "node:assert/strict";
import test from "node:test";

import {
  columnName,
  messageFromRow,
  messageToRow,
  parseStringArray,
  profileFromRow,
  profileToRow,
  safeFileName,
  type DoggoDatesMessage,
  type DoggoDatesProfile,
} from "./composioData.js";

test("round-trips a profile row used by Composio Sheets storage", () => {
  const profile: DoggoDatesProfile = {
    _id: "user-1",
    spectrumUserId: "user-1",
    spectrumSpaceId: "space-1",
    ownerName: "Darshan",
    dogName: "Bruno",
    breed: "Golden retriever",
    photoFileIds: ["file-1"],
    photoUrls: ["https://drive.google.com/file/d/file-1/view"],
    profileComplete: true,
    humanStatus: "reviewing",
    humanNotes: "good park match",
    createdAt: 100,
    updatedAt: 200,
  };

  assert.deepEqual(profileFromRow(profileToRow(profile)), profile);
});

test("round-trips a message row used by Composio Sheets storage", () => {
  const message: DoggoDatesMessage = {
    _id: "message-1",
    spectrumMessageId: "message-1",
    spectrumUserId: "user-1",
    spectrumSpaceId: "space-1",
    direction: "inbound",
    contentType: "image",
    text: "[image: bruno.jpg; image/jpeg]",
    driveFileId: "file-1",
    attachmentUrl: "https://drive.google.com/file/d/file-1/view",
    createdAt: 123,
  };

  assert.deepEqual(messageFromRow(messageToRow(message)), message);
});

test("sanitizes Drive filenames and safely parses JSON arrays", () => {
  assert.equal(safeFileName('  bruno:/\\*?"<>|.jpg  '), "bruno---------.jpg");
  assert.deepEqual(parseStringArray('["a","b",2]'), ["a", "b"]);
  assert.deepEqual(parseStringArray("not-json"), []);
  assert.equal(columnName(1), "A");
  assert.equal(columnName(26), "Z");
  assert.equal(columnName(27), "AA");
});
