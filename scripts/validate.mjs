#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(
  await readFile(join(root, "data/cases.json"), "utf8"),
);
const schema = JSON.parse(
  await readFile(join(root, "schema/cases.schema.json"), "utf8"),
);
const readme = await readFile(join(root, "README.md"), "utf8");
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/;
const allowedHosts = new Set(["pixexid.com", "images.pixexid.com", "alosem.com"]);
const forbiddenKeys =
  /^(?:owner|private|storage)|^(?:user(?:_?id)?|email|avatar|secret|token|cookie|authorization)$/i;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function checkKeys(value, path = "case") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.test(key), `Private field ${path}.${key}`);
    checkKeys(child, `${path}.${key}`);
  }
}

function checkUrl(value, item, host = item.origin === "alosem" ? "alosem.com" : null) {
  const url = new URL(value);
  assert(url.protocol === "https:", `Non-HTTPS URL: ${item.id}`);
  assert(allowedHosts.has(url.hostname), `Non-allowlisted URL: ${item.id}`);
  if (host) assert(url.hostname === host, `Cross-origin URL: ${item.id}`);
  return url;
}

function checkAlosemSource(value, assetId, item) {
  const url = checkUrl(value, item, "alosem.com");
  assert(
    url.pathname ===
      `/api/compositions/${item.recipe.compositionId}/sources/${assetId}` &&
      url.searchParams.get("scene") === item.recipe.sceneId &&
      url.searchParams.get("publication") === item.recipe.publicationId &&
      url.searchParams.get("epoch") === String(item.recipe.publicationEpoch) &&
      url.searchParams.size === 3,
    `Invalid epoch-scoped source URL: ${item.id}`,
  );
}

function checkShared(item) {
  assert(uuid.test(item.id), `Invalid id: ${item.id}`);
  assert(item.title && item.description && item.model, `Missing text: ${item.id}`);
  assert(Array.isArray(item.steps) && item.steps.length > 0, `Recipe steps missing: ${item.id}`);
  assert(item.references.length > 0, `References missing: ${item.id}`);
  for (const key of ["canonical_url", "composition_url", "source_api", "image_url"])
    checkUrl(item[key], item);
  item.references.forEach((reference, index) => {
    assert(reference.order === index + 1, `Reference order mismatch: ${item.id}`);
    assert(reference.id && reference.role && reference.title, `Incomplete reference: ${item.id}`);
  });
  for (const step of item.steps) {
    assert(step.order >= 1 && step.title, `Incomplete step: ${item.id}`);
    assert(step.output?.id, `Invalid step output: ${item.id}`);
    step.references.forEach((reference, index) =>
      assert(reference.order === index + 1, `Step reference order mismatch: ${item.id}`),
    );
  }
}

function checkPixexid(item) {
  assert(item.prompt, `Missing v1 prompt: ${item.id}`);
  assert(item.model === item.model_metadata.name, `Model mismatch: ${item.id}`);
  assert(
    item.recipe.shareInputs === true && item.recipe.inputCount > 0,
    `Recipe is not public: ${item.id}`,
  );
  assert(item.references.length === item.recipe.inputCount, `Reference count mismatch: ${item.id}`);
  assert(
    item.stage_count === new Set(item.steps.map((step) => step.scene_id)).size,
    `Stage count mismatch: ${item.id}`,
  );
  assert(item.steps.at(-1).output.public_image_id === item.id, `Final step output mismatch: ${item.id}`);
  assert(item.provenance.moderation === "approved", `Unapproved case: ${item.id}`);
  for (const key of ["sha256", "source_sha256", "import_manifest_sha256"])
    assert(sha256.test(item.provenance[key]), `Invalid ${key}: ${item.id}`);
  for (const key of ["canonical_url", "composition_url", "source_api"])
    assert(new URL(item[key]).hostname === "pixexid.com", `Invalid ${key}: ${item.id}`);
  assert(new URL(item.image_url).hostname === "images.pixexid.com", `Invalid image URL: ${item.id}`);
  for (const step of item.steps) {
    assert(step.prompt, `Missing v1 step prompt: ${item.id}`);
    assert(uuid.test(step.output.id), `Invalid step output: ${item.id}`);
    for (const reference of step.references)
      assert(uuid.test(reference.id), `Invalid step reference: ${item.id}`);
  }
}

function checkAlosem(item) {
  checkKeys(item);
  assert(
    item.prompt_kind === "standalone-interpretation" &&
      item.standalone_prompt &&
      item.exact_prompt &&
      item.standalone_prompt !== item.exact_prompt,
    `Invalid Alosem prompt layers: ${item.id}`,
  );
  assert(
    item.recipe.available === true &&
      uuid.test(item.recipe.compositionId) &&
      uuid.test(item.recipe.sceneId) &&
      uuid.test(item.recipe.publicationId) &&
      Number.isInteger(item.recipe.publicationEpoch) &&
      item.recipe.publicationEpoch >= 1,
    `Recipe is not public: ${item.id}`,
  );
  assert(item.references.length === item.recipe.inputCount, `Reference count mismatch: ${item.id}`);
  assert(
    item.stage_count === new Set(item.steps.map((step) => step.stage)).size,
    `Stage count mismatch: ${item.id}`,
  );
  assert(sha256.test(item.provenance.graphDigest), `Invalid graphDigest: ${item.id}`);
  assert(sha256.test(item.provenance.snapshotDigest), `Invalid snapshotDigest: ${item.id}`);
  const composition = checkUrl(item.composition_url, item, "alosem.com");
  assert(
    composition.pathname === `/ai-composition/${item.recipe.compositionId}` &&
      composition.searchParams.get("scene") === item.recipe.sceneId &&
      composition.searchParams.size === 1,
    `Composition URL mismatch: ${item.id}`,
  );
  assert(
    checkUrl(item.canonical_url, item, "alosem.com").pathname === `/i/${item.slug}` &&
      checkUrl(item.source_api, item, "alosem.com").pathname === `/api/images/${item.slug}`,
    `Canonical URL mismatch: ${item.id}`,
  );
  for (const step of item.steps) {
    assert(step.exact_prompt && step.model, `Missing exact step history: ${item.id}`);
    checkAlosemSource(step.output.image_url, step.output.id, item);
    for (const reference of step.references)
      checkAlosemSource(reference.image_url, reference.id, item);
  }
  assert(
    item.steps.at(-1).exact_prompt === item.exact_prompt &&
      item.steps.at(-1).model === item.model,
    `Final exact history mismatch: ${item.id}`,
  );
}

assert(
  schema.$id ===
    "https://github.com/pixexid/pixexid-prompt-atlas/schema/cases.schema.json",
  "Unexpected schema id",
);
assert(schema.properties.schema_version.const === 2, "Schema is not version 2");
assert(catalog.schema_version === 2, "Unsupported schema version");
assert(Array.isArray(catalog.cases) && catalog.cases.length > 0, "Catalog is empty");
assert(
  new Set(catalog.cases.map((item) => item.id)).size === catalog.cases.length,
  "Duplicate ids",
);
assert(
  catalog.cases.every(
    (item, index) =>
      index === 0 ||
      catalog.cases[index - 1].created_at.localeCompare(item.created_at) >= 0,
  ),
  "Cases are not ordered newest first",
);
assert(
  readme.includes("AI Image Compositions") &&
    readme.includes("Multi-Reference AI Composition"),
  "README positioning missing",
);

for (const item of catalog.cases) {
  assert(item.origin === "pixexid" || item.origin === "alosem", `Invalid origin: ${item.id}`);
  checkShared(item);
  if (item.origin === "pixexid") checkPixexid(item);
  else checkAlosem(item);

  const casePath = join(root, "cases", `${item.slug}.md`);
  await access(casePath);
  const casePage = await readFile(casePath, "utf8");
  for (const [name, page] of [
    ["README", readme],
    ["Case", casePage],
  ]) {
    let cursor = page.indexOf(`## [${item.title}](cases/${item.slug}.md)`);
    if (name === "Case") cursor = 0;
    for (const step of item.steps) {
      const stepIndex = page.indexOf(`${step.label} — ${step.title}`, cursor);
      const outputUrl =
        step.order === item.steps.length ? item.image_url : step.output.image_url;
      const outputIndex = page.indexOf(`src="${outputUrl}"`, stepIndex);
      assert(
        stepIndex >= cursor && outputIndex > stepIndex,
        `${name} step order is invalid: ${item.id}`,
      );
      cursor = outputIndex;
    }
  }
}

if (process.argv.includes("--links")) {
  const links = new Set(
    catalog.cases.flatMap((item) => [
      item.canonical_url,
      item.composition_url,
      item.image_url,
      item.source_api,
      ...item.steps.flatMap((step) => [
        step.output.image_url,
        ...step.references.map((reference) => reference.image_url),
      ]),
    ]),
  );
  const results = await Promise.all(
    [...links].map(async (url) => [
      url,
      await fetch(url, { signal: AbortSignal.timeout(15_000) }),
    ]),
  );
  for (const [url, response] of results) {
    assert(response.ok, `Broken link ${response.status}: ${url}`);
    if (
      url.includes("/api/creative-assets/") ||
      url.includes("/api/compositions/")
    )
      assert(
        response.headers.get("content-type")?.startsWith("image/"),
        `Non-image reference: ${url}`,
      );
  }
}

console.log(
  `Validated ${catalog.cases.length} cases${process.argv.includes("--links") ? " and public links" : ""}.`,
);
