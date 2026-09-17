#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(await readFile(join(root, "data/cases.json"), "utf8"));
const sources = JSON.parse(await readFile(join(root, "data/sources.json"), "utf8"));
const schema = JSON.parse(await readFile(join(root, "schema/cases.schema.json"), "utf8"));
const readme = await readFile(join(root, "README.md"), "utf8");
const categories = new Set([
  "product_visuals",
  "posters_typography",
  "transparent_assets",
  "character_identity",
  "illustration_backgrounds",
  "focused_edits",
]);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/;
const hex = /^#[0-9a-f]{6}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
const provenanceStatement =
  "Generated with built-in imagegen. Listed under the GPT Image 2.5 family; the exact backend variant was not exposed.";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function checkUrl(value, host, item, label) {
  const url = new URL(value);
  assert(url.protocol === "https:", "Non-HTTPS " + label + ": " + item.slug);
  assert(url.hostname === host, "Invalid " + label + " host: " + item.slug);
  return url;
}

export function validateCase(item) {
  if (item.kind === "campaign-team") return validateTeamCase(item);
  assert(item.kind === "campaign-standalone", "Invalid case discriminator: " + item.slug);
  assert(item.origin === "alosem", "Invalid origin: " + item.slug);
  assert(uuid.test(item.id), "Invalid id: " + item.slug);
  assert(item.slug && item.title && item.description, "Missing identity text: " + item.slug);
  assert(item.model === "GPT Image 2.5", "Invalid model: " + item.slug);
  assert(categories.has(item.category), "Invalid category: " + item.slug);
  assert(item.mode, "Missing mode: " + item.slug);
  assert(item.exact_prompt?.trim(), "Missing exact prompt: " + item.slug);
  assert(!item.exact_prompt.includes("```"), "Unsafe prompt fence: " + item.slug);
  assert(Array.isArray(item.tags) && item.tags.every(Boolean), "Invalid tags: " + item.slug);
  assert(
    Array.isArray(item.palette) && item.palette.every((color) => hex.test(color)),
    "Invalid palette: " + item.slug,
  );
  assert(
    Number.isInteger(item.dimensions?.width) &&
      item.dimensions.width > 0 &&
      Number.isInteger(item.dimensions?.height) &&
      item.dimensions.height > 0,
    "Invalid dimensions: " + item.slug,
  );
  assert(item.aspect, "Missing aspect: " + item.slug);
  assert(
    typeof item.hasTransparency === "boolean" &&
      (item.category === "transparent_assets") === item.hasTransparency,
    "Transparency/category mismatch: " + item.slug,
  );
  assert(
    item.provenance?.generationTool === "built-in imagegen" &&
      item.provenance.exactBackend === "unknown" &&
      item.provenance.statement === provenanceStatement,
    "Invalid provenance: " + item.slug,
  );
  assert(
    date.test(item.review?.checked) &&
      ["pass", "pass-with-limitations"].includes(item.review.verdict) &&
      item.review.notes?.trim(),
    "Invalid review: " + item.slug,
  );
  const canonical = checkUrl(item.canonical_url, "alosem.com", item, "canonical URL");
  assert(canonical.pathname === "/i/" + item.slug, "Canonical path mismatch: " + item.slug);
  for (const key of ["512", "1024", "original"]) {
    const image = checkUrl(item.image_urls?.[key], "pi.alosem.com", item, key + " image");
    assert(image.pathname.includes("/" + item.slug + "/"), "Image slug mismatch: " + item.slug);
  }
  assert(!Number.isNaN(Date.parse(item.created_at)), "Invalid creation date: " + item.slug);
}

export function validateTeamCase(item) {
  assert(item.origin === "team", "Invalid origin: " + item.slug);
  assert(uuid.test(item.id), "Invalid id: " + item.slug);
  assert(item.slug && item.title && item.description, "Missing identity text: " + item.slug);
  assert(item.model === "GPT Image 2.5", "Invalid model: " + item.slug);
  assert(categories.has(item.category), "Invalid category: " + item.slug);
  assert(
    item.category === "character_identity",
    "Team cases must be character-identity: " + item.slug,
  );
  assert(item.mode, "Missing mode: " + item.slug);
  assert(
    item.exact_prompt?.trim() && item.execution_prompt?.trim(),
    "Missing prompt layer: " + item.slug,
  );
  assert(
    !item.exact_prompt.includes("```") && !item.execution_prompt.includes("```"),
    "Unsafe prompt fence: " + item.slug,
  );
  assert(Array.isArray(item.tags) && item.tags.every(Boolean), "Invalid tags: " + item.slug);
  assert(
    Array.isArray(item.palette) && item.palette.every((color) => hex.test(color)),
    "Invalid palette: " + item.slug,
  );
  assert(
    Number.isInteger(item.dimensions?.width) &&
      item.dimensions.width > 0 &&
      Number.isInteger(item.dimensions?.height) &&
      item.dimensions.height > 0,
    "Invalid dimensions: " + item.slug,
  );
  assert(item.aspect, "Missing aspect: " + item.slug);
  assert(item.hasTransparency === false, "Team cases are opaque: " + item.slug);
  assert(
    item.provenance?.generationTool === "built-in imagegen" &&
      item.provenance.exactBackend === "unknown" &&
      item.provenance.statement === provenanceStatement,
    "Invalid provenance: " + item.slug,
  );
  assert(
    date.test(item.review?.checked) &&
      ["pass", "pass-with-limitations"].includes(item.review.verdict) &&
      item.review.notes?.trim(),
    "Invalid review: " + item.slug,
  );
  assert(
    Array.isArray(item.references) && item.references.length > 0,
    "Missing references: " + item.slug,
  );
  for (const reference of item.references) {
    assert(
      reference.file?.trim() && reference.role?.trim() && reference.provenance?.trim(),
      "Invalid reference: " + item.slug,
    );
    assert(sha256.test(reference.sha256), "Invalid reference hash: " + item.slug);
  }
  assert(
    item.preview?.path === "assets/" + item.slug + ".jpg",
    "Preview path mismatch: " + item.slug,
  );
  assert(
    Number.isInteger(item.preview.bytes) && item.preview.bytes > 0,
    "Invalid preview size: " + item.slug,
  );
  assert(
    sha256.test(item.preview.sha256) && sha256.test(item.preview.candidate_sha256),
    "Invalid preview hash: " + item.slug,
  );
  assert(item.preview.derivation?.trim(), "Missing preview derivation: " + item.slug);
  assert(!Number.isNaN(Date.parse(item.created_at)), "Invalid creation date: " + item.slug);
}

assert(schema.$id.startsWith("https://alosem.com/"), "Schema id is not Alosem-owned");
assert(schema.properties.schema_version.const === 3, "Schema is not version 3");
assert(
  schema.$defs.campaignCase.properties.kind.const === "campaign-standalone" &&
    schema.$defs.teamCase.properties.kind.const === "campaign-team" &&
    schema.$defs.historicalCase.properties.kind.const === "historical-composition",
  "Schema case discrimination is missing",
);
assert(catalog.schema_version === 3, "Unsupported catalogue version");
assert(catalog.cases.length === sources.length, "Source/catalogue count mismatch");
assert(catalog.cases.length === 37, "Expected 37 reviewed campaign cases");
assert(
  new Set(catalog.cases.map((item) => item.id)).size === catalog.cases.length &&
    new Set(catalog.cases.map((item) => item.slug)).size === catalog.cases.length,
  "Duplicate case identity",
);
assert(
  catalog.cases.every(
    (item, index) =>
      item.slug === sources[index].slug && item.category === sources[index].category,
  ),
  "Catalogue does not match the reviewed source list",
);

for (const item of catalog.cases) validateCase(item);

const counts = Object.fromEntries([...categories].map((key) => [key, 0]));
for (const item of catalog.cases) counts[item.category] += 1;
const marker = readme.match(/<!-- category-counts (\{[^\n]+\}) -->/);
assert(marker, "README category count marker missing");
assert(
  JSON.stringify(JSON.parse(marker[1])) === JSON.stringify(counts),
  "README category counts do not match catalogue",
);
assert(
  readme.startsWith("# GPT Image 2.5 Prompts & Examples — by Alosem") &&
    readme.includes("Independent community resource. Not affiliated with or endorsed by OpenAI."),
  "README launch positioning missing",
);

const expectedPages = new Set(catalog.cases.map((item) => item.slug + ".md"));
const actualPages = new Set(
  (await readdir(join(root, "cases"))).filter((name) => name.endsWith(".md")),
);
assert(
  expectedPages.size === actualPages.size &&
    [...expectedPages].every((name) => actualPages.has(name)),
  "Case pages do not match catalogue",
);
for (const item of catalog.cases) {
  const path = join(root, "cases", item.slug + ".md");
  await access(path);
  const page = await readFile(path, "utf8");
  if (item.kind === "campaign-team") {
    assert(
      page.includes("../" + item.preview.path) &&
        page.includes(item.exact_prompt) &&
        page.includes(item.execution_prompt) &&
        page.includes(item.review.notes) &&
        page.includes("Created for Alosem") &&
        item.references.every((reference) => page.includes(reference.sha256)),
      "Incomplete team case page: " + item.slug,
    );
    await access(join(root, item.preview.path));
    const asset = await readFile(join(root, item.preview.path));
    assert(asset.length === item.preview.bytes, "Preview size mismatch: " + item.slug);
    assert(
      createHash("sha256").update(asset).digest("hex") === item.preview.sha256,
      "Preview hash mismatch: " + item.slug,
    );
  } else {
    assert(
      page.includes(item.image_urls["1024"]) &&
        page.includes(item.exact_prompt) &&
        page.includes("[Open in Alosem](" + item.canonical_url + ")") &&
        page.includes(item.review.notes),
      "Incomplete case page: " + item.slug,
    );
  }
}

const brandPattern = new RegExp(["pix", "exid"].join(""), "i");
const repoFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root },
)
  .toString()
  .split("\0")
  .filter(Boolean);
for (const path of repoFiles) {
  let content;
  try {
    content = await readFile(join(root, path), "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") continue;
    throw error;
  }
  assert(!brandPattern.test(content), "Disallowed legacy brand reference: " + path);
}

if (process.argv.includes("--links")) {
  const links = [
    ...new Set(
      catalog.cases
        .filter((item) => item.kind === "campaign-standalone")
        .flatMap((item) => [
          item.canonical_url,
          item.image_urls["512"],
          item.image_urls["1024"],
          item.image_urls.original,
        ]),
    ),
  ];
  for (let offset = 0; offset < links.length; offset += 10) {
    await Promise.all(
      links.slice(offset, offset + 10).map(async (url) => {
        const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        assert(response.ok, "Broken link " + response.status + ": " + url);
        if (new URL(url).hostname === "pi.alosem.com")
          assert(
            response.headers.get("content-type")?.startsWith("image/"),
            "Non-image asset: " + url,
          );
        await response.body?.cancel();
      }),
    );
  }
}

console.log(
  "Validated " +
    catalog.cases.length +
    " campaign cases" +
    (process.argv.includes("--links") ? " and public links" : "") +
    ".",
);
