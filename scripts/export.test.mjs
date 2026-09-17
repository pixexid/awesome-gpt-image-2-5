import assert from "node:assert/strict";
import test from "node:test";

import { caseMarkdown, fetchCase } from "./export.mjs";

const slug = "fixture-case-11111111";
const source = {
  slug,
  category: "transparent_assets",
  review: {
    checked: "2026-09-17",
    verdict: "pass",
    notes: "Verified alpha and clear margins.",
  },
};

function record() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug,
    title: "Fixture Case",
    description: "A deterministic campaign fixture.",
    status: "published",
    model: "GPT Image 2.5",
    prompt: "Create one transparent fixture.",
    exactPrompt: "Create one transparent fixture.",
    mode: "txt2img",
    tags: ["fixture"],
    colors: ["#112233"],
    width: 1024,
    height: 1024,
    aspect: "1:1",
    hasTransparency: true,
    createdAt: "2026-09-17T00:00:00.000Z",
    imageUrl: "https://pi.alosem.com/" + slug + "/abc/original.webp",
    responsiveSources: [
      { width: 512, url: "https://pi.alosem.com/" + slug + "/abc/512.webp" },
      { width: 1024, url: "https://pi.alosem.com/" + slug + "/abc/1024.webp" },
    ],
  };
}

const stub = (mutate = () => {}) => async () => {
  const value = record();
  mutate(value);
  return Response.json(value);
};

test("projects one reviewed Alosem source into a campaign standalone case", async () => {
  const item = await fetchCase(source, stub());
  assert.equal(item.kind, "campaign-standalone");
  assert.equal(item.origin, "alosem");
  assert.equal(item.category, "transparent_assets");
  assert.equal(item.hasTransparency, true);
  assert.equal(item.image_urls["1024"], record().responsiveSources[1].url);
  assert.equal(item.provenance.exactBackend, "unknown");
  const page = caseMarkdown(item);
  assert.match(page, /## Exact prompt/);
  assert.match(page, /Open in Alosem/);
});

test("rejects unsupported model claims and asset hosts", async (t) => {
  await t.test("model", async () => {
    await assert.rejects(
      fetchCase(
        source,
        stub((value) => {
          value.model = "Unverified Model";
        }),
      ),
      /Invalid campaign source/,
    );
  });
  await t.test("asset host", async () => {
    await assert.rejects(
      fetchCase(
        source,
        stub((value) => {
          value.responsiveSources[0].url = "https://example.com/512.webp";
        }),
      ),
      /Invalid Alosem 512 image URL/,
    );
  });
});

test("rejects a missing exact submitted prompt", async () => {
  await assert.rejects(
    fetchCase(
      source,
      stub((value) => {
        value.exactPrompt = "";
      }),
    ),
    /Invalid campaign source/,
  );
});
