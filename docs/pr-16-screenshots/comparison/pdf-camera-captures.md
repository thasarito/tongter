# Camera-adjusted PDF comparison

The studio-pdf-*.webp files are genuine Chromium/WebGL canvas exports from application commit `2ea83be772777ca8bd8567c57165fcaab1bfd2da`. The capture uses the public 3D model → View → Match PDF framing action, switching Stage setup between Stage only (PDF page 3), Head table (page 4), and Cake table (page 5). Roof = Steel frame; walls = Full height.

The source PDF's page boxes are 780 × 540 pt (13:9). Original canvas PNG exports are 1560 × 1080; these full-frame previews are resized to 390 × 270 and WebP-compressed. No generated imagery, furniture replacement, camera injection in the test, or retouching is used. Canvas exports omit the studio controls and HTML labels. They use the public reference layout with an empty guest list and reject mutation requests.

The camera centers on the stage and fits visually estimated stage-edge coverage and baseline for each page. This is an approximate composition match, not recovered lens calibration: the PDF provides no lens metadata. The existing schematic venue/decorations, material colors, and furniture geometry remain different from the reference.

Verified source run: https://github.com/thasarito/tongter/actions/runs/35180771679
Original PNG artifact: https://github.com/thasarito/tongter/actions/runs/35180771679/artifacts/10480082942
The artifact expires September 24, 2026. The WebP previews are retained in this separate documentation branch independently of artifact retention. The original PDF previews in this directory are unchanged.
