import type { Lang } from "./i18n.ts";

/**
 * Dietary requirements as a configurable multi-select.
 *
 * Options are declared in config.ts so the couple can change them without
 * touching this file. Everything is stored in the sheet's single `dietary`
 * column as a comma-separated list, which keeps the schema unchanged and stays
 * readable to a human scanning the spreadsheet.
 *
 * Anything in that column that does not match a configured option id is kept as
 * free text rather than discarded. That matters twice: it preserves entries
 * typed before the options existed, and it means removing an option from the
 * config never silently erases what a guest already told you.
 */

export interface DietaryOption {
  /** Stable id written to the sheet. Changing it orphans existing answers. */
  id: string;
  label: { th: string; en: string };
}

export interface DietarySelection {
  /** Ids that matched a configured option. */
  selected: string[];
  /** Anything else found in the cell, or typed into the free-text box. */
  other: string;
}

export const EMPTY_DIETARY: DietarySelection = { selected: [], other: "" };

const SEPARATOR = ", ";

export function parseDietary(
  raw: string,
  options: readonly DietaryOption[],
): DietarySelection {
  const known = new Set(options.map((o) => o.id));
  const selected: string[] = [];
  const leftovers: string[] = [];

  for (const token of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
    if (known.has(token) && !selected.includes(token)) selected.push(token);
    else if (!known.has(token)) leftovers.push(token);
  }

  return { selected, other: leftovers.join(SEPARATOR) };
}

export function serializeDietary(selection: DietarySelection): string {
  const other = selection.other.trim();
  return [...selection.selected, ...(other ? [other] : [])].join(SEPARATOR);
}

export function isDietaryEmpty(selection: DietarySelection): boolean {
  return selection.selected.length === 0 && selection.other.trim() === "";
}

export function dietaryOptionLabel(option: DietaryOption, lang: Lang): string {
  return lang === "en" ? option.label.en : option.label.th;
}

/**
 * Human-readable list for display: configured options resolved to labels in the
 * chosen language, followed by any free text.
 */
export function dietaryLabels(
  selection: DietarySelection,
  options: readonly DietaryOption[],
  lang: Lang,
): string[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const labels = selection.selected.flatMap((id) => {
    const option = byId.get(id);
    // An id with no matching option means the config changed under existing
    // answers; show the raw id rather than dropping it.
    return [option ? dietaryOptionLabel(option, lang) : id];
  });
  const other = selection.other.trim();
  return other ? [...labels, other] : labels;
}

export function dietarySummary(
  selection: DietarySelection,
  options: readonly DietaryOption[],
  lang: Lang,
): string {
  return dietaryLabels(selection, options, lang).join(SEPARATOR);
}
