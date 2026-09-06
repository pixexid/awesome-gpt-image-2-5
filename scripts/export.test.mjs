import assert from "node:assert/strict";
import test from "node:test";

import { caseMarkdown, fetchCase } from "./export.mjs";

const ids = {
  image: "11111111-1111-4111-8111-111111111111",
  composition: "22222222-2222-4222-8222-222222222222",
  scene: "33333333-3333-4333-8333-333333333333",
  publication: "44444444-4444-4444-8444-444444444444",
  input: "55555555-5555-4555-8555-555555555555",
  output: "66666666-6666-4666-8666-666666666666",
  draft: "77777777-7777-4777-8777-777777777777",
};
const slug = "migrated-source-shared-fixture";
const canonical = `https://alosem.com/i/${slug}`;
const composition =
  `https://alosem.com/ai-composition/${ids.composition}?scene=${ids.scene}`;
const source = {
  origin: "alosem",
  canonical_url: canonical,
  composition_url: composition,
  rights_basis: "Deterministic migrated source-shared fixture.",
};
const standalone = "A folded-paper bird rests in warm window light.";
const exact = "Use Image 1 to create a folded-paper bird in warm window light.";
const draftExact = "Use Image 1 to build the first folded-paper bird study.";
const sourceUrl = (id, epoch = 7) =>
  `/api/compositions/${ids.composition}/sources/${id}?scene=${ids.scene}&publication=${ids.publication}&epoch=${epoch}`;

function fixture() {
  const record = {
    id: ids.image,
    slug,
    title: "Folded-paper bird",
    description: "A deterministic migrated composition fixture.",
    imageUrl: `/api/images/${slug}/media`,
    prompt: standalone,
    promptKind: "standalone-interpretation",
    exactPrompt: exact,
    model: "gpt-image-2",
    tags: ["paper-study"],
    colors: ["#ccbbaa"],
    status: "published",
    mime: "image/webp",
    outputFormat: "webp",
    width: 1024,
    height: 1024,
    createdAt: "2026-09-05T20:00:00.000Z",
  };
  const asset = (id, title) => ({
    id,
    title,
    alt: title,
    width: 1024,
    height: 1024,
    mime: "image/webp",
    previewUrl: sourceUrl(id),
  });
  const projection = {
    version: 1,
    compositionId: ids.composition,
    sceneId: ids.scene,
    publicationId: ids.publication,
    publicationEpoch: 7,
    image: {
      id: ids.image,
      slug,
      url: `/i/${slug}`,
      mediaUrl: `/api/images/${slug}/media`,
      title: record.title,
      description: record.description,
      alt: record.description,
      standalonePrompt: standalone,
      promptKind: "standalone-interpretation",
      width: 1024,
      height: 1024,
    },
    recipe: {
      available: true,
      graphDigest: "a".repeat(64),
      snapshotDigest: "b".repeat(64),
      rights: [ids.input, ids.draft, ids.output].map((assetId) => ({
        assetId,
        basis: "Fixture-owned source.",
      })),
      steps: [
        {
          output: asset(ids.draft, "First folded-paper bird study"),
          inputs: [
            {
              position: 1,
              role: "reference",
              asset: asset(ids.input, "Fold reference"),
            },
          ],
          exactPrompt: draftExact,
          model: record.model,
          revisionOf: null,
        },
        {
          output: asset(ids.output, record.title),
          inputs: [
            {
              position: 1,
              role: "composition",
              asset: asset(ids.draft, "First folded-paper bird study"),
            },
          ],
          exactPrompt: exact,
          model: record.model,
          revisionOf: ids.draft,
        },
      ],
    },
  };
  return { record, projection };
}

function stub(mutate = () => {}, { expireSources = false } = {}) {
  const data = fixture();
  mutate(data);
  return async (input) => {
    const url = new URL(String(input));
    if (url.pathname === `/api/images/${slug}`)
      return Response.json(data.record);
    if (url.pathname === `/i/${slug}`)
      return new Response(
        `<link rel="canonical" href="${canonical}"><meta property="og:image" content="https://alosem.com/api/images/${slug}/media">`,
      );
    if (url.pathname.endsWith("/recipe"))
      return Response.json(data.projection);
    if (url.pathname.includes("/sources/"))
      return new Response(expireSources ? null : "image", {
        status: expireSources ? 404 : 200,
        headers: {
          "content-type": expireSources ? "application/json" : "image/webp",
          "cache-control": "private, no-store",
        },
      });
    throw new Error(`Unexpected fixture request: ${url}`);
  };
}

const pixSlug = "retained-pixexid-fixture";
const pixSource = {
  origin: "pixexid",
  canonical_url: `https://pixexid.com/i/${pixSlug}`,
  composition_url:
    "https://pixexid.com/ai-composition/99999999-9999-4999-8999-999999999999",
  rights_basis: "Retained Pixexid fixture.",
};

function pixexidStub(mutate = () => {}) {
  const prompt = "Create a retained Pixexid fixture.";
  const input = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    publicImageId: null,
    title: "Input",
    description: "Input reference",
    prompt: null,
    model: null,
    kind: "image",
    width: 512,
    height: 512,
    mediaUrl: "https://pixexid.com/api/creative-assets/input/public",
  };
  const output = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    publicImageId: ids.image,
    title: "Retained output",
    description: "Retained output",
    prompt,
    model: "gpt-image-2",
    kind: "edit",
    width: 1024,
    height: 1024,
    mediaUrl: "https://pwi.pixexid.com/retained-output.webp",
  };
  const record = {
    id: ids.image,
    filename: `${pixSlug}.jpg`,
    approved: true,
    title: output.title,
    description: output.description,
    prompt,
    aiModel: output.model,
    width: output.width,
    height: output.height,
    createdAt: "2026-09-01T00:00:00.000Z",
    tags: ["retained"],
    colors: ["#ccbbaa"],
    gen_meta: {
      image_model: { name: output.model },
      creative: { inputCount: 1, shareInputs: true, kind: "edit" },
      provenance: {
        moderation: "approved",
        storage_key: `${pixSlug}.jpg`,
        sha256: "a".repeat(64),
        source_sha256: "b".repeat(64),
        import_manifest_sha256: "c".repeat(64),
        generated_on: "openai",
      },
      output: { format: "jpeg" },
      post: {},
    },
  };
  const project = {
    scenes: [
      {
        output: { publicImageId: record.id },
        steps: [
          {
            sceneId: ids.scene,
            output,
            inputs: [{ role: "reference", asset: input }],
          },
        ],
      },
    ],
  };
  mutate({ record, project });
  return async (value) => {
    const url = new URL(String(value));
    if (url.pathname === `/api/picture/by-filename/${pixSlug}`)
      return Response.json(record);
    if (url.pathname === `/i/${pixSlug}`)
      return new Response(
        `<link rel="canonical" href="${pixSource.canonical_url}"><meta property="og:image" content="https://images.pixexid.com/${pixSlug}.jpg">`,
      );
    if (url.pathname.startsWith("/ai-composition/"))
      return new Response(
        `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { project } } })}</script>`,
      );
    if (
      url.hostname === "pixexid.com" ||
      url.hostname === "pwi.pixexid.com"
    )
      return new Response("image", {
        headers: { "content-type": "image/webp" },
      });
    throw new Error(`Unexpected Pixexid fixture request: ${url}`);
  };
}

test("exports the Alosem v2 prompt layers, exact history, digests and ordered source URLs", async () => {
  const item = await fetchCase(source, stub());
  assert.equal(item.origin, "alosem");
  assert.equal(item.standalone_prompt, standalone);
  assert.equal(item.exact_prompt, exact);
  assert.deepEqual(item.steps.map((step) => step.exact_prompt), [draftExact, exact]);
  assert.deepEqual(item.steps.map((step) => step.label), ["Step 1", "Step 1 · Revision 2"]);
  assert.deepEqual(item.provenance, {
    graphDigest: "a".repeat(64),
    snapshotDigest: "b".repeat(64),
  });
  assert.equal(item.references[0].order, 1);
  const page = caseMarkdown(item);
  assert.ok(page.includes("Standalone interpretation · adapted creation prompt"));
  assert.ok(page.indexOf(item.references[0].image_url) < page.indexOf('width="760"'));
});

test("checks retained Pixexid export privacy while allowing provenance storage_key", async (t) => {
  const item = await fetchCase(pixSource, pixexidStub());
  assert.equal(item.provenance.storage_key, `${pixSlug}.jpg`);
  await t.test("public image record", async () => {
    await assert.rejects(
      fetchCase(
        pixSource,
        pixexidStub(({ record }) => {
          record.ownerId = "private-owner";
        }),
      ),
      /Private field in public response/,
    );
  });
  await t.test("composition projection", async () => {
    await assert.rejects(
      fetchCase(
        pixSource,
        pixexidStub(({ project }) => {
          project.scenes[0].owner_id = "private-owner";
        }),
      ),
      /Private field in public response/,
    );
  });
  await t.test("asset host", async () => {
    await assert.rejects(
      fetchCase(
        pixSource,
        pixexidStub(({ project }) => {
          project.scenes[0].steps[0].output.mediaUrl =
            "https://evil.example/output.webp";
        }),
      ),
      /Invalid Pixexid asset URL/,
    );
  });
});

test("refuses a flattened public prompt", async () => {
  await assert.rejects(
    fetchCase(
      source,
      stub(({ record, projection }) => {
        record.prompt = exact;
        projection.image.standalonePrompt = exact;
      }),
    ),
    /Flattened public and exact prompt/,
  );
});

test("refuses unavailable recipe sharing", async () => {
  await assert.rejects(
    fetchCase(
      source,
      stub(({ projection }) => {
        projection.recipe.available = false;
      }),
    ),
    /Incomplete Alosem recipe/,
  );
});

test("refuses expired and malformed publication epochs", async (t) => {
  await t.test("expired source", async () => {
    await assert.rejects(
      fetchCase(source, stub(() => {}, { expireSources: true })),
      /unavailable/,
    );
  });
  await t.test("bad epoch URL", async () => {
    await assert.rejects(
      fetchCase(
        source,
        stub(({ projection }) => {
          projection.recipe.steps[0].inputs[0].asset.previewUrl = sourceUrl(
            ids.input,
            8,
          );
        }),
      ),
      /Invalid epoch-scoped Alosem source URL/,
    );
  });
});

test("refuses a non-allowlisted source host", async () => {
  await assert.rejects(
    fetchCase({ ...source, canonical_url: `https://example.com/i/${slug}` }, stub()),
    /Invalid alosem source URL/,
  );
});

test("refuses a canonical final mismatch", async () => {
  await assert.rejects(
    fetchCase(
      source,
      stub(({ projection }) => {
          projection.image.id = "88888888-8888-4888-8888-888888888888";
      }),
    ),
    /Canonical final mismatch/,
  );
});

test("refuses unsafe script payloads", async () => {
  await assert.rejects(
    fetchCase(
      source,
      stub(({ record }) => {
        record.prompt = "unsafe </script> payload";
      }),
    ),
    /Unsafe <\/script> payload/,
  );
});

test("refuses private public-response fields", async (t) => {
  for (const key of ["ownerId", "private", "storage_key"]) {
    await t.test(key, async () => {
      await assert.rejects(
        fetchCase(
          source,
          stub(({ record }) => {
            record[key] = "must-not-escape";
          }),
        ),
        /Private field in public response/,
      );
    });
  }
});
