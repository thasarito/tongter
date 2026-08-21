import type { DietarySelection } from "../dietary.ts";
import type { Side, SnapshotStatus } from "../types.ts";

/**
 * View models: the shape each screen needs, and nothing else.
 *
 * Pages used to fetch a snapshot and then derive their own display data inline —
 * resolving groups, replaying previous answers, counting attendance, building
 * hrefs. That put real logic inside JSX files, so replacing the UI meant
 * rewriting the logic too, and none of it could be tested without rendering.
 *
 * These builders are pure: snapshot in, plain data out. No React, no Next, no
 * network. The UI reads a view model and decides how it looks; it never decides
 * what it means.
 */

export interface ViewBase {
  /** Whether the underlying data is live, cached, or absent. */
  status: SnapshotStatus;
}

/** Every token-addressed screen can fail the same way. */
export interface NotFoundView extends ViewBase {
  kind: "not-found";
}

export interface SeatRef {
  tableId: number;
  seatIndex: number;
}

export interface GuestSummary extends SeatRef {
  guestId: string;
  /** Already resolved to the requested language. */
  name: string;
}

export interface GuestWithAnswer extends GuestSummary {
  /** null when this guest has not been answered for yet. */
  attending: boolean | null;
}

export interface DietaryOptionView {
  id: string;
  /** Already resolved to the requested language. */
  label: string;
}

export interface RsvpGuestView extends GuestWithAnswer {
  dietary: DietarySelection;
  /** This person's own note to the couple. */
  note: string;
  /**
   * Pre-built field names, so the form component never has to know the wire
   * format — it just spreads these onto inputs.
   */
  fieldNames: {
    attending: string;
    dietary: string;
    dietaryOther: string;
    note: string;
  };
}

export interface RsvpFormView extends ViewBase {
  kind: "form";
  token: string;
  /** Group label in the requested language, empty when unset. */
  groupLabel: string;
  /** True when this group has submitted at least once before. */
  hasResponded: boolean;
  guests: RsvpGuestView[];
  submittedBy: string;
  dietaryOptions: DietaryOptionView[];
  allowDietaryOther: boolean;
  /** Names of the form-level fields. */
  fieldNames: {
    token: string;
    lang: string;
    submittedBy: string;
  };
}

export type RsvpView = RsvpFormView | NotFoundView;

export interface SeatView extends ViewBase {
  kind: "seat";
  token: string;
  celebrate: boolean;
  /** The seat to walk to; null when nobody in the group is attending. */
  focus: GuestSummary | null;
  group: GuestWithAnswer[];
  /** Seats to highlight — the whole group, including anyone who declined. */
  highlight: SeatRef[];
}

export type SeatPageView = SeatView | NotFoundView;

export interface SearchResultView extends GuestSummary {
  groupLabel: string;
  /** null when the guest's group is missing or has no token. */
  href: string | null;
}

export interface SearchView extends ViewBase {
  query: string;
  state: "idle" | "too-short" | "no-results" | "results";
  results: SearchResultView[];
}

export interface TableStatsView {
  tableId: number;
  shape: "long" | "round";
  seats: number;
  named: number;
  attending: number;
  declined: number;
}

export interface GroupStatusView {
  groupId: string;
  label: string;
  memberNames: string[];
  answered: number;
  total: number;
  state: "none" | "partial" | "complete";
  token: string;
  href: string;
}

export interface AdminView extends ViewBase {
  fetchedAt: number;
  warnings: string[];
  totals: {
    attending: number;
    declined: number;
    noResponse: number;
    seatsNamed: number;
    seatsTotal: number;
    groupsReplied: number;
    groupsTotal: number;
  };
  tables: TableStatsView[];
  /** One entry per attending guest who declared anything. */
  dietary: { name: string; notes: string[] }[];
  /** Aggregate headcount per option, for the caterer. */
  dietaryTotals: { label: string; count: number }[];
  messages: { from: string; text: string; at: string }[];
  groups: GroupStatusView[];
}

/**
 * A guest as the name picker sees them.
 *
 * Deliberately minimal: this list goes to the browser in full, so it carries
 * only what is needed to show a pill and match a search — no seat, no group, no
 * personal token.
 */
export interface PickerGuestView {
  guestId: string;
  /** Display name in the chosen language. */
  name: string;
  /** Both spellings, so the Thai-aware matcher works client-side. */
  nameTh: string;
  nameEn: string;
  /** First character, for the pill's monogram badge. */
  initial: string;
  side: Side | null;
}

export interface JourneyIntroView extends ViewBase {
  guests: PickerGuestView[];
  sideCounts: Record<Side, number>;
}

export interface QrCardView {
  groupId: string;
  label: string;
  memberNames: string[];
  token: string;
  url: string;
}

export interface QrSheetView extends ViewBase {
  cards: QrCardView[];
}
