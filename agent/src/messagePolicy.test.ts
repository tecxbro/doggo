import assert from "node:assert/strict";
import test from "node:test";

import {
  isExplicitConfirmation,
  isSupportedDogPhoto,
  MAX_TEXT_CHARACTERS,
  missingProfileFields,
  normalizeInboundText,
  profileWouldBeComplete,
} from "./messagePolicy.js";

const completeProfile = {
  ownerName: "Darshan",
  dogName: "Bruno",
  age: "3",
  breed: "Golden retriever",
  size: "large",
  location: "Irvine",
  personality: "friendly",
  energyLevel: "high",
  socialBehavior: "playful",
  preferredMeetup: "park walk",
  availability: "Sunday afternoon",
  dealbreakers: "no off-leash dates",
  photoStorageIds: ["photo_1"],
};

test("normalizes ordinary text and rejects oversized input", () => {
  assert.deepEqual(normalizeInboundText("  hello doggo  "), {
    kind: "accepted",
    text: "hello doggo",
  });
  assert.deepEqual(normalizeInboundText("   "), { kind: "empty" });
  assert.deepEqual(normalizeInboundText("x".repeat(MAX_TEXT_CHARACTERS + 1)), {
    kind: "too_long",
  });
});

test("accepts common dog photo formats but rejects SVG", () => {
  assert.equal(isSupportedDogPhoto("image/jpeg"), true);
  assert.equal(isSupportedDogPhoto("IMAGE/HEIC"), true);
  assert.equal(isSupportedDogPhoto("image/svg+xml"), false);
});

test("requires profile fields and a dog photo", () => {
  assert.deepEqual(missingProfileFields({ photoStorageIds: [] }), [
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
    "dogPhoto",
  ]);
  assert.deepEqual(missingProfileFields(completeProfile), []);
});

test("only completes after all missing fields are supplied", () => {
  const incomplete = { ...completeProfile, availability: undefined, photoStorageIds: [] };
  assert.equal(
    profileWouldBeComplete(incomplete, { availability: "Friday evening" }, true),
    true,
  );
  assert.equal(profileWouldBeComplete(incomplete, {}, false), false);
});

test("recognizes explicit profile confirmation", () => {
  assert.equal(isExplicitConfirmation("YES"), true);
  assert.equal(isExplicitConfirmation("looks good"), true);
  assert.equal(isExplicitConfirmation("maybe"), false);
});
