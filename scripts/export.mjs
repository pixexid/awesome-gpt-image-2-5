#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/;
const origins = {
  pixexid: { host: "pixexid.com", compositionPath: "/ai-composition/" },
  alosem: { host: "alosem.com", compositionPath: "/ai-composition/" },
};
const pixexidAssetHosts = new Set([
  "pixexid.com",
  "pwi.pixexid.com",
  "images.pixexid.com",
]);
const pixexidPrivateKey =
  /^(?:user|owner|email|avatar|secret|token|cookie|authorization)(?:_?id)?$/i;
const alosemPrivateKey =
  /^(?:owner|private|storage)|^(?:user(?:_?id)?|email|avatar|secret|token|cookie|authorization)$/i;

const fail = (message) => {
  throw new Error(message);
};
const markdownEscape = (value) => String(value).replaceAll("|", "\\|");
const roleLabel = (value) => `${value[0].toUpperCase()}${value.slice(1)}`;
const htmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function inspectPublicJson(value, path = "response", forbidden = alosemPrivateKey) {
  if (typeof value === "string") {
    if (/<\/script\s*>/i.test(value)) fail(`Unsafe </script> payload at ${path}`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden?.test(key))
      fail(`Private field in public response: ${path}.${key}`);
    inspectPublicJson(child, `${path}.${key}`, forbidden);
  }
}

async function responseJson(response, unavailable, forbidden = alosemPrivateKey) {
  if (!response.ok) fail(unavailable);
  const value = JSON.parse(await response.text());
  inspectPublicJson(value, "response", forbidden);
  return value;
}

function sourceUrls(source) {
  const config = origins[source.origin];
  if (!config) fail(`Unsupported source origin: ${source.origin}`);
  const canonical = new URL(source.canonical_url);
  const composition = new URL(source.composition_url);
  if (
    canonical.protocol !== "https:" ||
    composition.protocol !== "https:" ||
    canonical.hostname !== config.host ||
    composition.hostname !== config.host ||
    !/^\/i\/[^/]+$/.test(canonical.pathname) ||
    canonical.search ||
    canonical.hash ||
    !composition.pathname.startsWith(config.compositionPath) ||
    composition.hash
  )
    fail(`Invalid ${source.origin} source URL: ${canonical}`);
  return { canonical, composition };
}

async function fetchImage(fetchImpl, url, message, alosem = false) {
  const response = await fetchImpl(url);
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    fail(message);
  if (alosem) {
    const cache = response.headers.get("cache-control")?.toLowerCase() ?? "";
    if (!cache.includes("private") || !cache.includes("no-store"))
      fail(`Alosem source is not epoch-scoped: ${url}`);
  }
}

function pixexidAssetUrl(value, base, slug) {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !pixexidAssetHosts.has(url.hostname))
    fail(`Invalid Pixexid asset URL for ${slug}: ${url}`);
  return url.href;
}

async function fetchPixexidCase(source, fetchImpl) {
  const { canonical, composition } = sourceUrls(source);
  if (composition.search) fail(`Invalid pixexid composition URL: ${composition}`);
  const slug = basename(canonical.pathname);
  const apiUrl = `https://pixexid.com/api/picture/by-filename/${encodeURIComponent(slug)}`;
  const [apiResponse, pageResponse, projectResponse] = await Promise.all([
    fetchImpl(apiUrl),
    fetchImpl(canonical),
    fetchImpl(composition),
  ]);
  const record = await responseJson(
    apiResponse,
    `Public source unavailable for ${slug}`,
    pixexidPrivateKey,
  );
  if (!pageResponse.ok || !projectResponse.ok)
    fail(`Public source unavailable for ${slug}`);
  const [html, projectHtml] = await Promise.all([
    pageResponse.text(),
    projectResponse.text(),
  ]);
  const match = projectHtml.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) fail(`Public composition data missing: ${composition}`);
  const project = JSON.parse(match[1]).props?.pageProps?.project;
  if (!project) fail(`Public composition data missing: ${composition}`);
  inspectPublicJson(project, "composition", pixexidPrivateKey);

  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (canonicalMatch?.[1] !== source.canonical_url || !imageMatch)
    fail(`Public page metadata mismatch for ${slug}`);
  const finalImageUrl = pixexidAssetUrl(imageMatch[1], canonical, slug);
  if (
    !uuid.test(record.id) ||
    record.approved !== true ||
    !record.prompt ||
    !record.aiModel
  )
    fail(`Incomplete or unapproved public record for ${slug}`);
  if (record.gen_meta?.provenance?.moderation !== "approved")
    fail(`Public provenance is not approved for ${slug}`);

  const scene = project.scenes?.find(
    (item) => item.output?.publicImageId === record.id,
  );
  const finalStep = scene?.steps?.at(-1);
  if (
    !finalStep ||
    finalStep.output?.prompt !== record.prompt ||
    finalStep.inputs?.length !== record.gen_meta.creative.inputCount ||
    finalStep.inputs.some((input) => !input.asset)
  )
    fail(`Incomplete public recipe for ${slug}`);

  const publicAsset = async (asset, role, index, output = false) => {
    const imageUrl = pixexidAssetUrl(asset.mediaUrl, composition, slug);
    await fetchImage(
      fetchImpl,
      imageUrl,
      `Public ${output ? "output" : "reference"} ${index + 1} unavailable for ${slug}`,
    );
    return {
      order: index + 1,
      role,
      id: asset.id,
      public_image_id: asset.publicImageId,
      title: asset.title,
      description: asset.description,
      prompt: asset.prompt,
      model: asset.model,
      kind: asset.kind,
      dimensions: { width: asset.width, height: asset.height },
      image_url: imageUrl,
    };
  };
  const rawSteps = await Promise.all(
    scene.steps.map(async (item, index) => ({
      order: index + 1,
      scene_id: item.sceneId,
      title: item.output.title,
      prompt: item.output.prompt,
      output: await publicAsset(item.output, "output", index, true),
      references: await Promise.all(
        item.inputs.map(({ role, asset }, inputIndex) =>
          publicAsset(asset, role, inputIndex),
        ),
      ),
    })),
  );
  const stageIds = [...new Set(rawSteps.map((item) => item.scene_id))];
  const stageTotals = new Map(
    stageIds.map((id) => [
      id,
      rawSteps.filter((item) => item.scene_id === id).length,
    ]),
  );
  const stageRevisions = new Map();
  const steps = rawSteps.map((item) => {
    const stage = stageIds.indexOf(item.scene_id) + 1;
    const revision = (stageRevisions.get(item.scene_id) || 0) + 1;
    stageRevisions.set(item.scene_id, revision);
    return {
      ...item,
      stage,
      revision,
      label: `Step ${stage}${stageTotals.get(item.scene_id) > 1 ? ` · Revision ${revision}` : ""}`,
    };
  });

  return {
    origin: "pixexid",
    id: record.id,
    slug: record.filename.replace(/\.(jpe?g|png|webp|avif)$/i, ""),
    title: record.title,
    description: record.description,
    prompt: record.prompt,
    model: record.aiModel,
    model_metadata: record.gen_meta.image_model,
    tags: record.tags,
    colors: record.colors,
    dimensions: { width: record.width, height: record.height },
    created_at: record.createdAt,
    canonical_url: canonicalMatch[1],
    image_url: finalImageUrl,
    composition_url: source.composition_url,
    references: steps.at(-1).references,
    steps,
    stage_count: stageIds.length,
    recipe: record.gen_meta.creative,
    provenance: record.gen_meta.provenance,
    output: record.gen_meta.output,
    post_processing: record.gen_meta.post,
    rights: {
      attribution: "Pixexid",
      basis: source.rights_basis,
      linked_image_license:
        "Excluded from this repository's CC BY 4.0 catalog license; see Pixexid Terms.",
    },
    source_api: apiUrl,
  };
}

function alosemSourceUrl(asset, composition, projection) {
  const url = new URL(asset.previewUrl, composition);
  const expectedPath = `/api/compositions/${projection.compositionId}/sources/${asset.id}`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "alosem.com" ||
    url.pathname !== expectedPath ||
    url.searchParams.get("scene") !== projection.sceneId ||
    url.searchParams.get("publication") !== projection.publicationId ||
    url.searchParams.get("epoch") !== String(projection.publicationEpoch) ||
    url.searchParams.size !== 3
  )
    fail(`Invalid epoch-scoped Alosem source URL: ${url}`);
  return url.href;
}

async function fetchAlosemCase(source, fetchImpl) {
  const { canonical, composition } = sourceUrls(source);
  const slug = basename(canonical.pathname);
  const compositionId = basename(composition.pathname);
  const sceneId = composition.searchParams.get("scene");
  if (
    !uuid.test(compositionId) ||
    !uuid.test(sceneId ?? "") ||
    composition.searchParams.size !== 1
  )
    fail(`Alosem composition and scene ids are required: ${composition}`);
  const apiUrl = new URL(`/api/images/${encodeURIComponent(slug)}`, canonical);
  const recipeUrl = new URL(`/api/compositions/${compositionId}/recipe`, composition);
  recipeUrl.searchParams.set("scene", sceneId);
  recipeUrl.searchParams.set("export", "true");

  const [apiResponse, pageResponse, recipeResponse] = await Promise.all([
    fetchImpl(apiUrl),
    fetchImpl(canonical),
    fetchImpl(recipeUrl),
  ]);
  const [record, projection] = await Promise.all([
    responseJson(apiResponse, `Public source unavailable for ${slug}`),
    responseJson(recipeResponse, `Public recipe unavailable for ${slug}`),
  ]);
  if (!pageResponse.ok) fail(`Public source unavailable for ${slug}`);
  const html = await pageResponse.text();
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  const imageUrl = new URL(record.imageUrl, canonical).href;
  if (
    canonicalMatch?.[1] !== source.canonical_url ||
    imageMatch?.[1] !== imageUrl
  )
    fail(`Public page metadata mismatch for ${slug}`);
  if (
    !uuid.test(record.id) ||
    record.slug !== slug ||
    record.status !== "published" ||
    !record.prompt ||
    record.promptKind !== "standalone-interpretation" ||
    !record.exactPrompt ||
    !record.model
  )
    fail(`Incomplete Alosem public record for ${slug}`);
  if (
    projection.version !== 1 ||
    projection.compositionId !== compositionId ||
    projection.sceneId !== sceneId ||
    !uuid.test(projection.publicationId) ||
    !Number.isInteger(projection.publicationEpoch) ||
    projection.recipe?.available !== true ||
    !sha256.test(projection.recipe.graphDigest) ||
    !sha256.test(projection.recipe.snapshotDigest) ||
    !Array.isArray(projection.recipe.steps) ||
    projection.recipe.steps.length === 0
  )
    fail(`Incomplete Alosem recipe for ${slug}`);
  const projectedImageUrl = new URL(projection.image?.mediaUrl ?? "", composition).href;
  if (
    projection.image?.id !== record.id ||
    projection.image?.slug !== slug ||
    new URL(projection.image?.url ?? "", composition).href !== canonical.href ||
    projectedImageUrl !== imageUrl ||
    projection.image?.title !== record.title ||
    projection.image?.width !== record.width ||
    projection.image?.height !== record.height
  )
    fail(`Canonical final mismatch for ${slug}`);
  const lastStep = projection.recipe.steps.at(-1);
  if (
    record.prompt !== projection.image.standalonePrompt ||
    projection.image.promptKind !== "standalone-interpretation" ||
    record.exactPrompt !== lastStep.exactPrompt ||
    record.model !== lastStep.model
  )
    fail(`Prompt or model history mismatch for ${slug}`);
  if (record.prompt === record.exactPrompt)
    fail(`Flattened public and exact prompt for ${slug}`);

  const asset = async (item, role, index, output = false) => {
    const imageUrl = alosemSourceUrl(item, composition, projection);
    await fetchImage(
      fetchImpl,
      imageUrl,
      `Public ${output ? "output" : "reference"} ${index + 1} unavailable for ${slug}`,
      true,
    );
    return {
      order: index + 1,
      role,
      id: item.id,
      title: item.title,
      description: item.alt,
      kind: item.detail?.kind ?? "image",
      dimensions: { width: item.width, height: item.height },
      image_url: imageUrl,
    };
  };
  const rawSteps = await Promise.all(
    projection.recipe.steps.map(async (step, index) => ({
      order: index + 1,
      scene_id: sceneId,
      title: step.output.title,
      exact_prompt: step.exactPrompt,
      model: step.model,
      revision_of: step.revisionOf ?? null,
      output: await asset(step.output, "output", index, true),
      references: await Promise.all(
        step.inputs.map(({ position, role, asset: input }) => {
          if (position < 1) fail(`Invalid input position for ${slug}`);
          return asset(input, role, position - 1);
        }),
      ),
    })),
  );
  const outputs = new Map();
  let stageCount = 0;
  const steps = rawSteps.map((step) => {
    const prior = step.revision_of ? outputs.get(step.revision_of) : null;
    const stage = prior?.stage ?? ++stageCount;
    const revision = prior ? prior.revision + 1 : 1;
    const item = {
      ...step,
      stage,
      revision,
      label: `Step ${stage}${revision > 1 ? ` · Revision ${revision}` : ""}`,
    };
    outputs.set(step.output.id, item);
    return item;
  });
  for (const step of steps)
    if (step.references.some((reference, index) => reference.order !== index + 1))
      fail(`Incomplete ordered references for ${slug}`);

  return {
    origin: "alosem",
    id: record.id,
    slug,
    title: record.title,
    description: record.description,
    standalone_prompt: record.prompt,
    prompt_kind: record.promptKind,
    exact_prompt: record.exactPrompt,
    model: record.model,
    tags: record.tags,
    colors: record.colors,
    dimensions: { width: record.width, height: record.height },
    created_at: record.createdAt,
    canonical_url: canonical.href,
    image_url: imageUrl,
    composition_url: composition.href,
    references: steps.at(-1).references,
    steps,
    stage_count: stageCount,
    recipe: {
      available: true,
      compositionId,
      sceneId,
      publicationId: projection.publicationId,
      publicationEpoch: projection.publicationEpoch,
      inputCount: lastStep.inputs.length,
    },
    provenance: {
      graphDigest: projection.recipe.graphDigest,
      snapshotDigest: projection.recipe.snapshotDigest,
    },
    output: { format: record.outputFormat ?? record.mime?.split("/").at(-1) },
    rights: {
      attribution: "Pixexid",
      basis: source.rights_basis,
      linked_image_license:
        "Excluded from this repository's CC BY 4.0 catalog license; see Alosem Terms.",
    },
    source_api: apiUrl.href,
  };
}

export function fetchCase(source, fetchImpl = fetch) {
  if (source.origin === "pixexid") return fetchPixexidCase(source, fetchImpl);
  if (source.origin === "alosem") return fetchAlosemCase(source, fetchImpl);
  fail(`Unsupported source origin: ${source.origin}`);
}

function recipeVisual(item) {
  return item.steps
    .map((step) => {
      const inputs = step.references
        .map(
          (reference) => `<td align="center" valign="top">
<strong>${reference.order}. ${htmlEscape(roleLabel(reference.role))}</strong><br>
<a href="${reference.image_url}"><img src="${reference.image_url}" alt="${htmlEscape(reference.title)}" width="150"></a><br>
<sub>${htmlEscape(reference.title)}</sub>
</td>`,
        )
        .join("\n");
      const final = step.order === item.steps.length;
      return `### ${step.label} — ${htmlEscape(step.title)}

<table>
<tr>
${inputs}
</tr>
</table>

<p align="center"><strong>Ordered references → ${final ? "Final AI Image Composition" : "Step output"}</strong></p>

<p align="center">
<a href="${final ? item.canonical_url : step.output.image_url}"><img src="${final ? item.image_url : step.output.image_url}" alt="${htmlEscape(step.title)}" width="760"></a><br>
<strong>${htmlEscape(step.title)}</strong>
</p>

<details>
<summary>Exact prompt for ${step.label}</summary>

\`\`\`text
${step.prompt ?? step.exact_prompt}
\`\`\`
</details>`;
    })
    .join("\n\n");
}

export function caseMarkdown(item) {
  const isAlosem = item.origin === "alosem";
  const recipe = isAlosem
    ? `${item.stage_count} steps · ${item.references.length} final-step inputs · versioned export`
    : `${item.stage_count} steps · ${item.references.length} final-step inputs · ${markdownEscape(item.recipe.kind)}`;
  const provenance = isAlosem
    ? `| Graph digest | \`${item.provenance.graphDigest}\` |
| Snapshot digest | \`${item.provenance.snapshotDigest}\` |`
    : `| Generated | ${markdownEscape(item.provenance.generated_on)} |
| Moderation | ${markdownEscape(item.provenance.moderation)} |
| Output SHA-256 | \`${item.provenance.sha256}\` |
| Source SHA-256 | \`${item.provenance.source_sha256}\` |
| Import manifest SHA-256 | \`${item.provenance.import_manifest_sha256}\` |`;
  const prompt = isAlosem
    ? `## What you see

**Standalone interpretation · adapted creation prompt**

\`\`\`text
${item.standalone_prompt}
\`\`\``
    : `## Exact public prompt

\`\`\`text
${item.prompt}
\`\`\``;
  return `# ${item.title} — Multi-Reference AI Composition

**AI Image Composition recipe:** ${item.stage_count} steps → one final artwork.

${item.description}

## Ordered references → final result

${recipeVisual(item)}

Role labels and order come directly from the public ${isAlosem ? "Alosem" : "Pixexid"} recipe.

| Field | Value |
| --- | --- |
| Model | ${markdownEscape(item.model)} |
| Format | ${item.dimensions.width} × ${item.dimensions.height} ${markdownEscape(item.output.format)} |
| Recipe | ${recipe} |
| Tags | ${item.tags.map((tag) => `\`${tag}\``).join(" ")} |
| Canonical | [${isAlosem ? "Alosem" : "Pixexid"} image page](${item.canonical_url}) |
| Composition | [Public AI Composition recipe](${item.composition_url}) |

${prompt}

## Provenance

| Field | Value |
| --- | --- |
${provenance}

Catalog text and data are licensed under [CC BY 4.0](../LICENSE). Linked images are not relicensed here. ${item.rights.basis}
`;
}

export function readmeMarkdown(cases) {
  const gallery = cases
    .map(
      (item) => `## [${item.title}](cases/${item.slug}.md)

${item.description}

${recipeVisual(item)}

[${item.origin === "pixexid" ? "Exact prompt and provenance" : "Prompt and provenance"}](cases/${item.slug}.md) · [Canonical image](${item.canonical_url}) · [Public recipe](${item.composition_url})`,
    )
    .join("\n\n");
  return `<h1 align="center">Multi-Reference AI Composition — Pixexid Prompt Atlas</h1>

<p align="center"><strong>AI Image Compositions built from ordered visual references, exact prompts, and public recipes.</strong></p>

<p align="center">
  See how <a href="https://pixexid.com">Pixexid</a> and <a href="https://alosem.com">Alosem</a> expose reproducible artwork built from identity, character, product, logo, style, and other visual references.
</p>

<p align="center">
  <a href="data/cases.json"><img alt="JSON data" src="https://img.shields.io/badge/data-JSON-24443B"></a>
  <a href="LICENSE"><img alt="CC BY 4.0" src="https://img.shields.io/badge/catalog-CC_BY_4.0-D9775F"></a>
  <a href="LICENSE-CODE"><img alt="MIT licensed code" src="https://img.shields.io/badge/code-MIT-D7A236"></a>
</p>

This is a curated, machine-readable atlas of **Multi-Reference AI Composition** recipes. Every case below shows its ordered public inputs and each intermediate output, followed by the final result—so the complete method is visible without leaving GitHub.

${gallery}

## Use the structured data

Each case includes its ordered references, public and exact prompt fields, model, dimensions, tags, palette, recipe metadata, and provenance in [\`data/cases.json\`](data/cases.json). Pixexid v1 records remain intact; Alosem records use the v2 two-layer prompt and digest provenance shape. The schema is [\`schema/cases.schema.json\`](schema/cases.schema.json).

\`\`\`sh
node -e 'const a=require("./data/cases.json"); console.log(a.cases.map(({title,origin,references})=>({title,origin,references:references.map(r=>r.role)})))'
\`\`\`

## Refresh from Pixexid or Alosem

The export is allowlisted: adding a case requires an explicit public source origin, canonical image URL, composition URL, and reviewed rights basis in [\`data/sources.json\`](data/sources.json).

\`\`\`sh
node scripts/export.mjs
node scripts/validate.mjs --links
\`\`\`

The dependency-free exporter reads only anonymous public Pixexid or Alosem pages and APIs. It allows assets only from the evidenced \`pixexid.com\`, \`pwi.pixexid.com\`, \`images.pixexid.com\`, and \`alosem.com\` hosts, and fails closed on unavailable pages, any other host, unapproved or unavailable recipes, missing or expired reference previews, flattened prompt layers, mismatched canonical finals, incomplete provenance, unsafe script payloads, or private fields. It never connects to either database, object storage, production credentials, generation, import, or publication surfaces.

## Rights and safety

This atlas contains only Pixexid-admin-owned, original AI Image Compositions with public source sharing enabled. It excludes private user records, private masters, third-party source files, real-person identity material, secrets, and work with unclear rights.

Catalog text and structured data are [CC BY 4.0](LICENSE); scripts are [MIT](LICENSE-CODE). Linked images remain remotely hosted and are not relicensed by this repository. See the [rights scope](RIGHTS.md) and [contribution policy](CONTRIBUTING.md).

Create and explore more on [Pixexid](https://pixexid.com) and [Alosem](https://alosem.com).
`;
}

export async function exportCatalog(sources, fetchImpl = fetch) {
  const cases = [];
  for (const source of sources) cases.push(await fetchCase(source, fetchImpl));
  cases.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return cases;
}

async function main() {
  const sources = JSON.parse(
    await readFile(join(root, "data/sources.json"), "utf8"),
  );
  const cases = await exportCatalog(sources);
  await mkdir(join(root, "cases"), { recursive: true });
  await writeFile(
    join(root, "data/cases.json"),
    `${JSON.stringify({ schema_version: 2, cases }, null, 2)}\n`,
  );
  for (const item of cases)
    await writeFile(join(root, "cases", `${item.slug}.md`), caseMarkdown(item));
  await writeFile(join(root, "README.md"), readmeMarkdown(cases));
  console.log(`Exported ${cases.length} public AI Image Compositions.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
