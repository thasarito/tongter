import type { SheetActionSummary } from "../model/sheet-action-summary";

export interface SheetConfirmation { id: string; summary: SheetActionSummary; error: string }
/** One explicit user approval per action. No network or persistence before confirm. */
export class SheetConfirmationGate {
  private pending: { review: SheetConfirmation; execute: () => void } | null = null;
  private executing = false;
  private readonly publish: (review: SheetConfirmation | null) => void;
  constructor(publish: (review: SheetConfirmation | null) => void) { this.publish = publish; }
  get current(): SheetConfirmation | null { return this.pending?.review ?? null; }
  request(summary: SheetActionSummary, execute: () => void): boolean {
    if (this.pending || this.executing) return false;
    const review = { id: crypto.randomUUID(), summary: structuredClone(summary), error: "" };
    this.pending = { review, execute };
    this.publish(review);
    return true;
  }
  confirm(id: string): void {
    const pending = this.pending;
    if (!pending || pending.review.id !== id || pending.review.error || this.executing) return;
    // Consume synchronously: a double click or old handler cannot submit twice.
    this.pending = null;
    this.executing = true;
    try { pending.execute(); this.publish(null); }
    catch (cause) {
      const error = cause instanceof Error ? cause.message : "The action could not be confirmed. Cancel and review it again.";
      this.pending = { ...pending, review: { ...pending.review, error } };
      this.publish(this.pending.review);
    } finally { this.executing = false; }
  }
  cancel(id: string): void {
    if (this.pending?.review.id !== id || this.executing) return;
    this.pending = null;
    this.publish(null);
  }
}
