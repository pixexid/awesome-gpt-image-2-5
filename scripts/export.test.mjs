import assert from "node:assert/strict";
import test from "node:test";

import { caseMarkdown, fetchCase, teamCase } from "./export.mjs";

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

test("projects a team source into a reference-based case", () => {
  const source = {
    slug: "team-fixture-case-11111111",
    category: "character_identity",
    kind: "team",
    review: {
      checked: "2026-09-17",
      verdict: "pass",
      notes: "Verified against the anchor sheet.",
    },
    case: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Team Fixture Case",
      description: "A deterministic team fixture.",
      mode: "reference-based identity-preserve",
      exact_prompt: "Create one fixture.",
      execution_prompt: "Use case: identity-preserve\nPrimary request: fixture.",
      tags: ["fixture"],
      palette: ["#112233"],
      dimensions: { width: 1024, height: 1024 },
      aspect: "1:1",
      hasTransparency: false,
      references: [
        {
          file: "fixture.png",
          role: "fixture anchor",
          sha256: "a".repeat(64),
          provenance: "Founder-supplied fixture sheet.",
        },
      ],
      preview: {
        path: "assets/team-fixture-case-11111111.jpg",
        bytes: 12345,
        sha256: "b".repeat(64),
        candidate_sha256: "c".repeat(64),
        derivation: "Byte-identical copy of the verified candidate.",
      },
      created_at: "2026-09-17T00:00:00.000Z",
    },
  };
  const item = teamCase(source);
  assert.equal(item.kind, "campaign-team");
  assert.equal(item.origin, "team");
  assert.equal(item.hasTransparency, false);
  const page = caseMarkdown(item);
  assert.match(page, /## Reference-based run recipe/);
  assert.match(page, /Created for Alosem/);
  assert.match(page, /\.\.\/assets\/team-fixture-case-11111111\.jpg/);
  assert.match(page, /Use case: identity-preserve/);
});
