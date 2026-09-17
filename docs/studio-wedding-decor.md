# Wedding art-direction refinement

The source is the supplied `15.11.26_K.TONG-K.TER@NAILERT_03.pdf`, primarily pages 3–5. The existing PDF comparison cameras and 13:9 capture dimensions are held fixed so that model changes, rather than new framing, account for the improvement.

## Modeled from the source

- Page 3: brown three-level stepped platform; smaller ivory-gray backing panel; existing Warissara/Thasarit path-only wordmark; pleated vertical cloth, layered U-shaped swags and pooled hems; asymmetric ivory/blush/lime flowers and suspended florals.
- Page 4: transverse draped head table, two wooden bridal chairs, tabletop and trailing flowers, tall candles and small votives. These are attached to the stage's local transform and elevated to its deck.
- Page 5: circular pleated cloth and a low, berry-topped cake, replacing the earlier invented tiered cake.
- Pages 6–8 and 10: flowers/candles on existing guest tables, a draped welcome mirror and registration table, a schematic name-free seating chart, and a freestanding drape/floral garden backdrop. These secondary arrangements have not been camera-matched to those pages.

## Rendering and interaction

`scene/decor/geometry.ts` contains pure geometry and deterministic flower sampling. `Fabric.tsx` builds folded surfaces with bounded tessellation. `Flowers.tsx` batches petals and leaves instead of creating a mesh per blossom. `StageDecor.tsx` composes the source-specific setups. `WeddingDecor.tsx` composes indoor/outdoor context.

All cosmetic mesh raycasts are explicitly disabled. Setting raycast only on a parent group does not disable its descendants. The selectable stage remains part of the furniture group; its three tiers stay inside the original footprint and preserve the sheet-backed height. Turning decorations off restores the original zone material and backing panel. Furniture and garden visibility switches also control their decorations.

No new dependencies, external models, font downloads, PDF images projected over the scene, guest records, or Google Sheets mutations are introduced. The existing local `logo.svg` is tessellated into SVG outline geometry, avoiding the invisible raster texture found in the first capture. Fabric and wordmark geometries are disposed on unmount. The existing on-demand renderer remains in use.

## Visual review iterations

The first fixed-camera capture exposed rigid-looking folds, a missing rasterized wordmark, and table skirting that narrowed incorrectly at the tabletop. The second pass softens pleat depth, broadens the layered swags, uses actual wordmark outlines, covers the complete table edge, keeps the cake cloth on the top deck, and adjusts stage/backboard tones against the reference. The backdrop and carpet do not receive the original shell's harsh diagonal shadows, matching the flatter art-direction treatment; the geometry still participates in the real scene.

## Interpretation limits

The source is a visual proposal, not surveyed decoration dimensions, cloth patterns, a botanical schedule or calibrated cameras. Decor proportions are estimates. The venue shell, glazing, roof structure, lighting and background garden remain schematic. Procedural rosettes and folded surfaces do not constitute a photorealistic or exact species-by-species reproduction. Entrance/garden placements are approximate; the seating chart contains abstract lines, never real names.

## Verification

Geometry tests cover tread bounds, transformed stage attachment, real cloth depth, full-width tablecloth coverage, closed cake-cloth seams, finite coordinates, bounded deterministic flowers and raycast passthrough. A wordmark test tessellates the actual repository SVG. Existing camera/browser tests capture stage/head-table/cake-table, portrait and walkthrough views without real guest data. Initial scene readiness is awaited for up to 30 seconds on CPU SwiftShader: the diagnostic run took 9.3 seconds, exceeding the former generic 5-second assertion. This is not a native-device FPS measurement.

Visual review assets are maintained on the separate screenshot documentation branch, not in the production bundle.
