import assert from "node:assert/strict";
import test from "node:test";

import { parseAgentResultContent } from "./agentResult.js";

function validPayload() {
  return {
    replies: ["  okay wait, bruno sounds iconic  "],
    extracted: {
      ownerName: "  Darshan ",
      dogName: " Bruno ",
      age: null,
      breed: null,
      size: null,
      gender: null,
      location: null,
      personality: null,
      energyLevel: null,
      socialBehavior: null,
      preferredMeetup: null,
      availability: null,
      dealbreakers: null,
    },
    profileComplete: false,
  };
}

test("parses and trims a valid structured response", () => {
  const result = parseAgentResultContent(JSON.stringify(validPayload()));

  assert.deepEqual(result, {
    replies: ["okay wait, bruno sounds iconic"],
    extracted: { ownerName: "Darshan", dogName: "Bruno" },
    profileComplete: false,
  });
});

test("rejects invalid JSON", () => {
  assert.throws(() => parseAgentResultContent("not-json"), /invalid JSON/);
});

test("rejects empty replies after trimming", () => {
  const payload = validPayload();
  payload.replies = ["   "];
  assert.throws(() => parseAgentResultContent(JSON.stringify(payload)), /empty Datto reply/);
});

test("rejects unexpected structured fields", () => {
  const payload = { ...validPayload(), unexpected: true };
  assert.throws(() => parseAgentResultContent(JSON.stringify(payload)));
});
