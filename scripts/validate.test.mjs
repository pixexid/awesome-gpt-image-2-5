import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateCase } from "./validate.mjs";

const cases = JSON.parse(
  await readFile(new URL("../data/cases.json", import.meta.url), "utf8"),
).cases;

test("validates all 37 campaign cases", () => {
  assert.equal(cases.length, 37);
  for (const item of cases) assert.doesNotThrow(() => validateCase(item));
});

test("rejects team case preview and reference drift", () => {
  const team = structuredClone(cases.find((item) => item.kind === "campaign-team"));
  assert.ok(team, "team case fixture missing");
  const previewDrift = structuredClone(team);
  previewDrift.preview.path = "assets/other.jpg";
  assert.throws(() => validateCase(previewDrift), /Preview path mismatch/);
  const referenceDrift = structuredClone(team);
  referenceDrift.references[0].sha256 = "not-a-hash";
  assert.throws(() => validateCase(referenceDrift), /Invalid reference hash/);
});

test("campaign and historical records cannot cross the discriminator", () => {
  const changed = structuredClone(cases[0]);
  changed.kind = "historical-composition";
  assert.throws(() => validateCase(changed), /Invalid case discriminator/);
});

test("rejects campaign category, model, prompt, canonical and transparency drift", async (t) => {
  const mutations = [
    ["category", (item) => (item.category = "other"), /Invalid category/],
    ["model", (item) => (item.model = "Unverified Model"), /Invalid model/],
    ["prompt", (item) => (item.exact_prompt = ""), /Missing exact prompt/],
    [
      "canonical",
      (item) => (item.canonical_url = "https://example.com/i/example"),
      /Invalid canonical URL host/,
    ],
    [
      "transparency",
      (item) => (item.hasTransparency = !item.hasTransparency),
      /Transparency\/category mismatch/,
    ],
  ];
  for (const [name, mutate, expected] of mutations) {
    await t.test(name, () => {
      const changed = structuredClone(cases[0]);
      mutate(changed);
      assert.throws(() => validateCase(changed), expected);
    });
  }
});
