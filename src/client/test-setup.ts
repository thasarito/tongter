import "@testing-library/jest-dom/vitest";

// jsdom has no native dialog top layer. Browser tests exercise real modal focus/inertness.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}
