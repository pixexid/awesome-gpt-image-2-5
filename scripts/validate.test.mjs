import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateCase } from "./validate.mjs";

const cases = JSON.parse(
  await readFile(new URL("../data/cases.json", import.meta.url), "utf8"),
).cases.filter((item) => item.origin === "pixexid");

test("validates all five retained Pixexid cases and their evidenced asset hosts", () => {
  assert.equal(cases.length, 5);
  for (const item of cases) assert.doesNotThrow(() => validateCase(item));
  const hosts = new Set(
    cases.flatMap((item) => [
      new URL(item.image_url).hostname,
      ...item.references.map((reference) => new URL(reference.image_url).hostname),
      ...item.steps.flatMap((step) => [
        new URL(step.output.image_url).hostname,
        ...step.references.map((reference) => new URL(reference.image_url).hostname),
      ]),
    ]),
  );
  assert.deepEqual(
    [...hosts].sort(),
    ["images.pixexid.com", "pixexid.com", "pwi.pixexid.com"],
  );
});

test("retained Pixexid validation allows storage_key but rejects private keys", async (t) => {
  for (const item of cases) {
    await t.test(item.id, () => {
      assert.ok(item.provenance.storage_key);
      assert.doesNotThrow(() => validateCase(item));
      const leaked = structuredClone(item);
      leaked.provenance.ownerId = "private-owner";
      assert.throws(() => validateCase(leaked), /Private field/);
    });
  }
  for (const key of [
    "owner",
    "owner_id",
    "ownerId",
    "user",
    "userId",
    "email",
    "avatar",
    "secret",
    "token",
    "cookie",
    "authorization",
  ]) {
    const leaked = structuredClone(cases[0]);
    leaked.provenance[key] = "private";
    assert.throws(() => validateCase(leaked), /Private field/);
  }
});

test("rejects evil hosts in every Pixexid asset URL position for all retained cases", async (t) => {
  const mutations = [
    [
      "final",
      (item) => (item.image_url = "https://evil.example/final.webp"),
      /Non-allowlisted URL/,
    ],
    [
      "top-level reference",
      (item) =>
        (item.references[0].image_url = "https://evil.example/reference.webp"),
      /Invalid Pixexid top-level reference URL/,
    ],
    [
      "step reference",
      (item) =>
        (item.steps[0].references[0].image_url =
          "https://evil.example/reference.webp"),
      /Invalid Pixexid step reference URL/,
    ],
    [
      "step output",
      (item) =>
        (item.steps[0].output.image_url = "https://evil.example/output.webp"),
      /Invalid Pixexid step output URL/,
    ],
  ];
  for (const item of cases) {
    for (const [position, mutate, expected] of mutations) {
      await t.test(`${item.id} ${position}`, () => {
        const changed = structuredClone(item);
        mutate(changed);
        assert.throws(
          () => validateCase(changed),
          expected,
        );
      });
    }
  }
});
