#!/usr/bin/env node

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const api = "https://alosem.com/api/images/";
const assetHosts = new Set(["alosem.com", "pi.alosem.com"]);
const provenanceStatement =
  "Generated with built-in imagegen. Listed under the GPT Image 2.5 family; the exact backend variant was not exposed.";
const teamLabel =
  "This team-generated campaign case was produced directly by the Alosem team with built-in imagegen from founder-provided identity sheets; it is neither externally published nor created through the Alosem creative product, so it is labeled **Created for Alosem**.";
const categories = [
  ["product_visuals", "Product visuals"],
  ["posters_typography", "Posters & typography"],
  ["transparent_assets", "Transparent assets"],
  ["character_identity", "Character identity"],
  ["illustration_backgrounds", "Illustration & backgrounds"],
  ["focused_edits", "Focused edits"],
];
const openingSlugs = [
  "cream-terminal-that-never-existed-b3d4a9d3",
  "glow-retro-poster-of-a-bass-player-and-boy-6b2eb59a",
  "pressed-flower-wren-on-twig-slice-4712aff7",
  "canal-bridge-screenprint-slice-1919a777",
  "girl-holding-a-fallen-moon-in-a-tidal-pool-65b8e726",
  "ancient-sword-bridges-a-canyon-of-pages-0a39debe",
];
const workedSlug = "glow-retro-poster-of-a-bass-player-and-boy-6b2eb59a";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fail = (message) => {
  throw new Error(message);
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function checkedUrl(value, expectedHost, label) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !assetHosts.has(url.hostname))
    fail("Invalid Alosem " + label + " URL: " + value);
  if (expectedHost && url.hostname !== expectedHost)
    fail("Unexpected host for " + label + ": " + value);
  return url.toString();
}

export async function fetchCase(source, fetchImpl = fetch) {
  const response = await fetchImpl(api + encodeURIComponent(source.slug), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail("Alosem image unavailable (" + response.status + "): " + source.slug);

  const record = await response.json();
  if (
    record.slug !== source.slug ||
    !uuid.test(record.id) ||
    record.status !== "published" ||
    record.model !== "GPT Image 2.5" ||
    !record.exactPrompt?.trim() ||
    record.exactPrompt !== record.prompt
  )
    fail("Invalid campaign source: " + source.slug);

  const responsive = record.responsiveSources.map((item) => item.url);
  const imageUrls = {
    512: checkedUrl(
      responsive.find((url) => url.endsWith("/512.webp")),
      "pi.alosem.com",
      "512 image",
    ),
    1024: checkedUrl(
      responsive.find((url) => url.endsWith("/1024.webp")),
      "pi.alosem.com",
      "1024 image",
    ),
    original: checkedUrl(record.imageUrl, "pi.alosem.com", "original image"),
  };
  const canonical = checkedUrl(
    "https://alosem.com/i/" + record.slug,
    "alosem.com",
    "canonical",
  );

  return {
    kind: "campaign-standalone",
    origin: "alosem",
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    model: record.model,
    category: source.category,
    mode: record.mode,
    exact_prompt: record.exactPrompt,
    tags: record.tags,
    palette: record.colors,
    dimensions: { width: record.width, height: record.height },
    aspect: record.aspect,
    hasTransparency: record.hasTransparency === true,
    provenance: {
      generationTool: "built-in imagegen",
      exactBackend: "unknown",
      statement: provenanceStatement,
    },
    review: source.review,
    canonical_url: canonical,
    image_urls: imageUrls,
    created_at: record.createdAt,
  };
}

export function teamCase(source) {
  const detail = source.case;
  if (!detail) fail("Missing team case detail: " + source.slug);
  return {
    kind: "campaign-team",
    origin: "team",
    id: detail.id,
    slug: source.slug,
    title: detail.title,
    description: detail.description,
    model: "GPT Image 2.5",
    category: source.category,
    mode: detail.mode,
    exact_prompt: detail.exact_prompt,
    execution_prompt: detail.execution_prompt,
    tags: detail.tags,
    palette: detail.palette,
    dimensions: detail.dimensions,
    aspect: detail.aspect,
    hasTransparency: detail.hasTransparency === true,
    provenance: {
      generationTool: "built-in imagegen",
      exactBackend: "unknown",
      statement: provenanceStatement,
    },
    review: source.review,
    references: detail.references,
    preview: detail.preview,
    created_at: detail.created_at,
  };
}

export function caseMarkdown(item) {
  if (item.kind === "campaign-team") return teamCaseMarkdown(item);
  return (
    "# " +
    item.title +
    "\n\n" +
    item.description +
    "\n\n" +
    '<p align="center"><a href="' +
    item.canonical_url +
    '"><img src="' +
    item.image_urls["1024"] +
    '" alt="' +
    escapeHtml(item.description) +
    '" width="760"></a></p>\n\n' +
    "[Open in Alosem](" +
    item.canonical_url +
    ")\n\n" +
    "## Exact prompt\n\n" +
    "Copy this submitted prompt as a starting point. Image generation is nondeterministic, so a rerun will not reproduce identical pixels.\n\n" +
    "```text\n" +
    item.exact_prompt +
    "\n```\n\n" +
    "## Provenance\n\n" +
    "| Field | Value |\n| --- | --- |\n" +
    "| Model family | GPT Image 2.5 |\n" +
    "| Generation tool | built-in imagegen |\n" +
    "| Exact backend | unknown |\n" +
    "| Mode | " +
    item.mode +
    " |\n" +
    "| Dimensions | " +
    item.dimensions.width +
    " × " +
    item.dimensions.height +
    " |\n" +
    "| Transparency | " +
    (item.hasTransparency ? "Yes" : "No") +
    " |\n\n" +
    item.provenance.statement +
    "\n\n" +
    "## Review notes and limitations\n\n" +
    "**" +
    item.review.verdict +
    " · checked " +
    item.review.checked +
    ".** " +
    item.review.notes +
    "\n\n" +
    "This externally generated result is **Curated on Alosem**. “Made with Alosem” is reserved for work actually created through an Alosem creative workflow.\n\n" +
    "Catalogue text and data are licensed under [CC BY 4.0](../LICENSE). Linked images are not relicensed by this repository.\n"
  );
}

export function teamCaseMarkdown(item) {
  const references = item.references
    .map(
      (reference, index) =>
        index +
        1 +
        ". `" +
        (reference.path || reference.file) +
        "` — " +
        reference.role +
        "\n   - SHA-256 `" +
        reference.sha256 +
        "`\n   - " +
        reference.provenance,
    )
    .join("\n");
  const referenceEmbeds = item.references
    .filter((reference) => reference.path)
    .map(
      (reference) =>
        '<p align="center"><a href="../' +
        reference.path +
        '"><img src="../' +
        reference.path +
        '" alt="Reference sheet: ' +
        escapeHtml(reference.role) +
        '" width="420"></a></p>',
    )
    .join("\n");
  return (
    "# " +
    item.title +
    "\n\n" +
    item.description +
    "\n\n" +
    '<p align="center"><img src="../' +
    item.preview.path +
    '" alt="' +
    escapeHtml(item.description) +
    '" width="760"></p>\n\n' +
    "## Exact prompt\n\n" +
    "Copy this standalone prompt as a starting point. Image generation is nondeterministic, so a rerun will not reproduce identical pixels.\n\n" +
    "```text\n" +
    item.exact_prompt +
    "\n```\n\n" +
    "## Reference-based run recipe\n\n" +
    "This case was generated from founder-provided reference sheets rather than from text alone. The sheets are required image inputs to reproduce the run; each is published below and under `assets/references/` so the result can be compared with its references, and the standalone prompt above remains the public copyable prompt.\n\n" +
    "**Ordered references**\n\n" +
    references +
    "\n\n" +
    (referenceEmbeds ? referenceEmbeds + "\n\n" : "") +
    "**Exact execution prompt**\n\n" +
    "```text\n" +
    item.execution_prompt +
    "\n```\n\n" +
    "## Provenance\n\n" +
    "| Field | Value |\n| --- | --- |\n" +
    "| Model family | GPT Image 2.5 |\n" +
    "| Generation tool | built-in imagegen |\n" +
    "| Exact backend | unknown |\n" +
    "| Mode | " +
    item.mode +
    " |\n" +
    "| Dimensions | " +
    item.dimensions.width +
    " × " +
    item.dimensions.height +
    " |\n" +
    "| Transparency | " +
    (item.hasTransparency ? "Yes" : "No") +
    " |\n\n" +
    item.provenance.statement +
    "\n\n" +
    "## Review notes and limitations\n\n" +
    "**" +
    item.review.verdict +
    " · checked " +
    item.review.checked +
    ".** " +
    item.review.notes +
    "\n\n" +
    teamLabel +
    "\n\n" +
    "Catalogue text and data are licensed under [CC BY 4.0](../LICENSE). The preview image is hosted in this repository under the same licence.\n"
  );
}

function openingGrid(cases) {
  const bySlug = new Map(cases.map((item) => [item.slug, item]));
  const cards = openingSlugs.map((slug) => bySlug.get(slug));
  if (cards.some((item) => !item)) fail("Opening grid case missing");

  const rows = [];
  for (let index = 0; index < cards.length; index += 3) {
    const group = cards.slice(index, index + 3);
    rows.push(
      "<tr>\n" +
        group
          .map(
            (item) =>
              '<td align="center" valign="top"><a href="cases/' +
              item.slug +
              '.md"><img src="' +
              item.image_urls["512"] +
              '" alt="' +
              escapeHtml(item.description) +
              '" width="260"></a><br><strong>' +
              escapeHtml(item.title) +
              "</strong></td>",
          )
          .join("\n") +
        "\n</tr>",
    );
  }
  return "<table>\n" + rows.join("\n") + "\n</table>";
}

export function readmeMarkdown(cases) {
  const counts = Object.fromEntries(
    categories.map(([key]) => [key, cases.filter((item) => item.category === key).length]),
  );
  const categoryIndex = categories
    .map(([key, label]) => {
      const links = cases
        .filter((item) => item.category === key)
        .map((item) => "[" + item.title + "](cases/" + item.slug + ".md)")
        .join(" · ");
      return "| " + label + " | " + counts[key] + " | " + (links || "No reviewed case in this release") + " |";
    })
    .join("\n");
  const worked = cases.find((item) => item.slug === workedSlug);
  if (!worked) fail("Worked example missing");

  return (
    "# GPT Image 2.5 Prompts & Examples — by Alosem\n\n" +
    "Original examples and exact prompts — curated by Alosem.\n\n" +
    "See what each prompt produced and adapt it for your own work. The standalone and transparent cases need no source images; the character-identity cases were generated from reference sheets and need those sheets as inputs to reproduce. Browse all " +
    cases.length +
    " reviewed examples here or continue in Alosem.\n\n" +
    "[Browse examples](#category-index) · [Open the visual gallery](https://alosem.com) · [Read the JSON catalogue](data/cases.json)\n\n" +
    "Independent community resource. Not affiliated with or endorsed by OpenAI.\n\n" +
    "## Six examples to start with\n\n" +
    openingGrid(cases) +
    "\n\n" +
    "This release contains standalone generations, transparent assets, and reference-based character-identity cases. The character-identity cases were generated by the Alosem team from founder-provided identity sheets; reproducing them requires those reference sheets as image inputs, and the sheets are not included in this repository. No case is labeled an edit because no reviewed public edit exposed its required source images.\n\n" +
    "## Category index\n\n" +
    "<!-- category-counts " +
    JSON.stringify(counts) +
    " -->\n\n" +
    "| Category | Cases | Examples |\n| --- | ---: | --- |\n" +
    categoryIndex +
    "\n\n" +
    "## Complete worked example\n\n" +
    "### [" +
    worked.title +
    "](cases/" +
    worked.slug +
    ".md)\n\n" +
    worked.description +
    "\n\n" +
    '<p align="center"><a href="' +
    worked.canonical_url +
    '"><img src="' +
    worked.image_urls["1024"] +
    '" alt="' +
    escapeHtml(worked.description) +
    '" width="520"></a></p>\n\n' +
    "#### Exact prompt\n\n```text\n" +
    worked.exact_prompt +
    "\n```\n\n" +
    "**Review:** " +
    worked.review.notes +
    "\n\n[Open in Alosem](" +
    worked.canonical_url +
    ") · [Read the complete case](cases/" +
    worked.slug +
    ".md)\n\n" +
    "## Provenance\n\n" +
    provenanceStatement +
    "\n\n" +
    "No seed, API quality setting, cost, or backend ID is claimed because those values were not exposed. “Made with Alosem” is used only when Alosem was part of the creative workflow, and externally published examples are **Curated on Alosem**. The character-identity cases are team-generated campaign work and carry a third label, **Created for Alosem**.\n\n" +
    "## Use the catalogue\n\n" +
    "The machine-readable [catalogue](data/cases.json) and [schema](schema/cases.schema.json) drive every case page and the counts above. Refresh and verify the export with:\n\n" +
    "```sh\nnode scripts/export.mjs\nnode --test scripts/*.test.mjs\nnode scripts/validate.mjs --links\n```\n\n" +
    "## Contributing and licensing\n\n" +
    "Contributions must provide a public Alosem image, the exact submitted prompt, accurate model-family provenance, rights to share the material, and a completed visual review. See [CONTRIBUTING.md](CONTRIBUTING.md).\n\n" +
    "Catalogue text and structured data are [CC BY 4.0](LICENSE); scripts are [MIT](LICENSE-CODE). Linked images remain remotely hosted and are not relicensed here. See [RIGHTS.md](RIGHTS.md).\n"
  );
}

export async function exportCatalog(sources, fetchImpl = fetch) {
  return Promise.all(
    sources.map((source) =>
      source.kind === "team"
        ? Promise.resolve(teamCase(source))
        : fetchCase(source, fetchImpl),
    ),
  );
}

async function main() {
  const sources = JSON.parse(await readFile(join(root, "data/sources.json"), "utf8"));
  const cases = await exportCatalog(sources);
  const caseDir = join(root, "cases");
  await mkdir(caseDir, { recursive: true });
  const expected = new Set(cases.map((item) => item.slug + ".md"));
  for (const name of await readdir(caseDir))
    if (name.endsWith(".md") && !expected.has(name)) await unlink(join(caseDir, name));
  await writeFile(
    join(root, "data/cases.json"),
    JSON.stringify({ schema_version: 3, cases }, null, 2) + "\n",
  );
  for (const item of cases)
    await writeFile(join(caseDir, item.slug + ".md"), caseMarkdown(item));
  await writeFile(join(root, "README.md"), readmeMarkdown(cases));
  console.log("Exported " + cases.length + " Alosem campaign cases.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
