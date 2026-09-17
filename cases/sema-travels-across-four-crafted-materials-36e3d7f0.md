# Sema Travels Across Four Crafted Materials

Sema's fixed identity moves across wool, ceramic, carved wood, and translucent resin in one comparative study.

<p align="center"><img src="../assets/sema-travels-across-four-crafted-materials-36e3d7f0.jpg" alt="Sema's fixed identity moves across wool, ceramic, carved wood, and translucent resin in one comparative study." width="760"></p>

## Exact prompt

Copy this standalone prompt as a starting point. Image generation is nondeterministic, so a rerun will not reproduce identical pixels.

```text
A polished four-cell material study presents the same Sema head in felted wool, glazed ceramic, carved and painted wood, and translucent cast resin. Every cell preserves her slightly wide near-circular bob silhouette, diagonal golden fringe, low-centered ivory face, black oval eyes with winged lashes, and tiny smile while making the physical medium unmistakable through fibers, glaze, wood grain, or suspended resin depth. A restrained charcoal grid and even specimen lighting make comparison immediate. Each head is fully contained at matching scale; no labels, body parts, text, logos, or watermark.
```

## Reference-based run recipe

This case was generated from founder-provided reference sheets rather than from text alone. Those sheets are required image inputs to reproduce the run, they are not included in this repository, and the standalone prompt above remains the public copyable prompt.

**Ordered references**

1. `sema-directions-v2-review.png` — Primary Sema silhouette, angle, bob geometry, hair-sweep, face-inset, line-placement, and palette anchor
   - SHA-256 `e1d800ae146552a6818e7a4f56ed3b63302a387df3295062dcb4cf79e2c2c786`
   - Founder-supplied raster review sheet; upstream model provenance unavailable.
2. `sema-reactions-v2-review.png` — Primary Sema eye, lash, mouth, expression-language, and accent anchor
   - SHA-256 `7bac316938369e9fae96a10d4e6b864843280f9ce8ceb580b63c7c3b462ed717`
   - Founder-supplied raster review sheet; upstream model provenance unavailable.

**Exact execution prompt**

```text
Use case: style-transfer
Asset type: identity-across-media material study
Primary request: Create one polished 2-by-2 study sheet showing the exact same Sema head from Images 1 and 2 physically re-rendered in four unmistakably different media: needle-felted wool, glazed ceramic relief, carved and painted wood, and translucent cast resin. Preserve identity geometry in every cell; change material only.
Input images: Image 1 is the primary silhouette, viewing-angle, hair-sweep, face-inset, line-placement, and palette anchor. Image 2 is the primary eye, lash, mouth, and expression-language anchor.
Scene/backdrop: Four equal charcoal specimen cells separated by thin warm-gray rules; no labels or captions.
Subject and load-bearing identity proportions: The same one Sema head in every cell, no body. Preserve the near-circular horizontal oval silhouette, slightly wider than tall; compact bob ending in two rounded lower side lobes; heavy golden fringe beginning near top-center and sweeping diagonally across the forehead to the lower-right cheek; shorter pointed lock on the left. Preserve the warm-ivory face inset centered low inside the hair mass at roughly two-thirds of total head width, wide soft cheeks, small rounded chin, evenly spaced black oval eyes at mid-face, outer winged lashes, no nose, and tiny curved mouth.
Cell media: top-left needle-felted wool with visible fibers and stitched black features; top-right glossy glazed ceramic relief with glaze pooling; bottom-left carved and painted wood with shallow tool marks and visible grain; bottom-right translucent cast resin with suspended golden pigment and embedded opaque face/features. All retain the same cream, gold, ochre, and black palette.
Composition/framing: Exact 2-by-2 grid, one fully contained head per cell, matching scale, viewing angle, face placement, and expression, generous padding, no overlap.
Lighting/mood: Even museum specimen lighting tailored subtly to reveal each material.
Constraints: Identity proportions must match across all four cells and the references. Exactly four heads total. No body, neck, ears, nose, extra face, duplicated cell, text, labels, logos, watermark, cropped silhouette, or medium ambiguity.
Avoid: taller oval heads, narrow face insets, reversed or centered fringe, realistic human faces, four color variants of the same material, flat printed vector copies, inconsistent eye spacing or mouth placement.
```

## Provenance

| Field | Value |
| --- | --- |
| Model family | GPT Image 2.5 |
| Generation tool | built-in imagegen |
| Exact backend | unknown |
| Mode | reference-based style-transfer |
| Dimensions | 1254 × 1254 |
| Transparency | No |

Generated with built-in imagegen. Listed under the GPT Image 2.5 family; the exact backend variant was not exposed.

## Review notes and limitations

**pass · checked 2026-09-17.** Verification confirmed four genuinely distinct materials rather than four colourways: needle-felted wool with matted fibre nap and stitched features, glazed ceramic with pooled gloss in the contour channels, carved painted wood with directional grain and chiselled tool facets, and translucent cast resin with internal depth and suspended pigment flecks. The same head appears in all four cells — measured head bounding boxes of 444×414, 426×405, 429×410, and 451×433 give a width spread of 5.9% and a height spread of 6.9%, with every W/H ratio in 1.042–1.072. Grid geometry was measured as an exact 2×2 with a complete outer border — full-width rules at y=6–7, 623–624, and 1246–1247, full-height rules at x=6–7, 626–627, and 1246–1247 — with each head well inside its cell and no boundary overlap. Exactly four heads, no labels, captions, text, or watermark.

This team-generated campaign case was produced directly by the Alosem team with built-in imagegen from founder-provided identity sheets; it is neither externally published nor created through the Alosem creative product, so it is labeled **Created for Alosem**.

Catalogue text and data are licensed under [CC BY 4.0](../LICENSE). The preview image is hosted in this repository under the same licence.
