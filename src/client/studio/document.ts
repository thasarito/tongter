import { studioShell } from "./shell";
import css from "./studio.css?raw";
import venueModel from "./runtime/venue-model.js.txt?raw";
import guestModel from "./runtime/guest-model.js.txt?raw";
import seatModel from "./runtime/seat-model.js.txt?raw";
import labelModel from "./runtime/label-model.js.txt?raw";
import walkMotion from "./runtime/walk-motion.js.txt?raw";
import renderer from "./runtime/renderer.js.txt?raw";
import application1 from "./runtime/application-1.js.txt?raw";
import application2 from "./runtime/application-2.js.txt?raw";
import application3 from "./runtime/application-3.js.txt?raw";
import application4 from "./runtime/application-4.js.txt?raw";
import integration from "./runtime/integration.js.txt?raw";
import referenceImage from "../../../docs/seat_plan.jpg?inline";
import thirdPartyLicense from "./THIRD-PARTY-LICENSES.txt?raw";

// These are trusted source files, not imported user HTML. Guest files are data
// only and are parsed by GuestModel; they can never supply executable scripts.
function script(source: string): string {
  return `<script>${source.replace(/<\/script/gi, "<\\/script")}</script>`;
}
function jsonScript(id: string, value: unknown): string {
  return `<script id="${id}" type="application/json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Reuse the v5 runtime without polluting React's document, styles or listeners.
 * No guest roster, token, secret, or private browser snapshot is bundled.
 * The document is fully inline, so its own portable exporter remains usable.
 */
export function createStudioDocument(hostOrigin: string): string {
  const bootstrap = `window.__STUDIO_HOST_ORIGIN__=${JSON.stringify(hostOrigin).replace(/</g, "\\u003c")};`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Glass House · Tong &amp; Ter planning studio</title><style>${css}</style></head><body>${studioShell}`
    + jsonScript("embedded-label-settings", { guestNames: true })
    // null intentionally selects GuestModel.defaultLayout(): 20 tables, no guests.
    + jsonScript("embedded-layout", null)
    + jsonScript("embedded-engine", null)
    + jsonScript("reference-data", { layout: referenceImage })
    + script(bootstrap)
    + [venueModel, guestModel, seatModel, labelModel, walkMotion, renderer].map(script).join("\n")
    // The four ordered application fragments deliberately form ONE IIFE.
    + script([application1, application2, application3, integration, application4].join("\n"))
    + `<script type="text/plain" id="third-party-license">${thirdPartyLicense.replace(/<\/script/gi, "<\\/script")}</script>`
    + "</body></html>";
}
