# PDF target / baseline / refined studio

These are genuine Chromium/WebGL captures of application commit `7f2e6bba570916a1c80370a46bd2e6e2a65312f0`, from successful verification job in run 35185034475 (#116). The comparison retains the PDF camera compositions and 1560 x 1080 canvas dimensions used by baseline commit `2ea83be772777ca8bd8567c57165fcaab1bfd2da`. No camera code changed in this model-refinement iteration.

The three WebP files are full-canvas captures resized to 390 x 270, without cropping, retouching or generative imagery. Stage and head-table previews use WebP quality 55; the cake-table preview uses quality 26 for compact transport. Source PNGs, including mobile views, are in https://github.com/thasarito/tongter/actions/runs/35185034475/artifacts/10482400861 (expires September 24, 2026).

The screenshot fixture uses the public reference layout with an empty guest list, intercepts the layout API and rejects mutation requests. These captures do not access live guest data or write to Google Sheets. Images are hosted only on this documentation branch, outside the application bundle.

Two visual-review passes replaced the initial flat triangles and large spheres with folded cloth, pooled hems and instanced flower rosettes, added brown stage steps and the local wedding wordmark as SVG outlines, and corrected the head-table orientation, two chairs, complete skirting and low berry-topped cake. The second pass corrected an invisible raster wordmark, excessive fold depth and tablecloth gaps. A subsequent rendering-cost pass reduced petal tessellation and removed per-petal shadow rendering; the final screenshots were recaptured after that change.

The model remains a procedural interpretation, not an exact or photorealistic reproduction. Natural fabric irregularity, botanical details, venue roof/glazing, floor, light setup and surrounding landscape still differ. Entrance and garden placement remain approximate and have not received camera-matched comparisons. No image of the PDF is projected over the scene. Reference photo people and prices are not part of the 3D model.

All individual decorative mesh raycasts are disabled, while the underlying stage remains selectable. Stage attachment, tread bounds, finite cloth geometry, tablecloth coverage, deterministic flower budgets, SVG outline generation and real rendered wordmark pixels are covered by tests. The existing camera presets, table layout, guests, seating assignments and Sheets schema/write path are unchanged by this refinement. No native-device frame-rate claim is made.
