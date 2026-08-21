"use server";

import { redirect } from "next/navigation";
import { dietaryOptions } from "@/lib/config";
import {
  fromFormData,
  parseRsvpForm,
  toSheetEntries,
  type RsvpErrorKey,
} from "@/shared/rsvp-form";
import { appendRsvp, findGroupByToken, getSnapshot, guestsInGroup } from "@/lib/sheets";

export interface RsvpFormState {
  status: "idle" | "error";
  /** Dictionary key under `rsvp`; the UI resolves it to copy. */
  errorKey?: RsvpErrorKey;
}

/**
 * Records a group's RSVP.
 *
 * Nothing but the token is trusted from the request: the member list is re-read
 * from the sheet and answers are collected by walking it, so a crafted POST
 * cannot answer for somebody in a different group. Reading and validating the
 * fields is lib/rsvp-form's job — this function only does the I/O.
 */
export async function submitRsvp(
  _prev: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  const values = fromFormData(formData);
  const token = values.get("token")?.trim() ?? "";

  const snapshot = await getSnapshot();
  const group = findGroupByToken(snapshot, token);
  if (!group) return { status: "error", errorKey: "errorBody" };

  const guests = guestsInGroup(snapshot, group.groupId);
  const parsed = parseRsvpForm(values, guests, dietaryOptions);
  if (!parsed.ok) return { status: "error", errorKey: parsed.errorKey };

  try {
    await appendRsvp({
      groupId: group.groupId,
      submittedBy: parsed.value.submittedBy,
      lang: parsed.value.lang,
      entries: toSheetEntries(parsed.value),
    });
  } catch (err) {
    console.error("[rsvp] append failed", err);
    return { status: "error", errorKey: "errorBody" };
  }

  // Outside the try: redirect signals by throwing, and must not be swallowed.
  redirect(`/seat/${token}?celebrate=1`);
}
