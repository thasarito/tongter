"use server";

import { allowDietaryOther, dietaryOptions } from "@/lib/config";
import { isLang, type Lang } from "@/lib/i18n";
import { getSnapshot } from "@/lib/sheets";
import { buildRsvpView, type RsvpFormView } from "@/lib/views";

export interface PersonFlow {
  view: RsvpFormView;
  /** The guest who identified themselves; their card comes first. */
  selfGuestId: string;
}

/**
 * Resolves a chosen guest into their group's RSVP form.
 *
 * Fetched on demand rather than shipped with the page: the picker only needs
 * names, and sending every group's seats and tokens to every visitor would hand
 * the whole guest list to anyone who opened dev tools.
 */
export async function loadPersonFlow(
  guestId: string,
  langRaw: string,
): Promise<PersonFlow | null> {
  if (!guestId) return null;
  const lang: Lang = isLang(langRaw) ? langRaw : "th";

  const snapshot = await getSnapshot();
  const guest = snapshot.guests.find((g) => g.guestId === guestId);
  if (!guest) return null;

  const group = snapshot.groups.find((g) => g.groupId === guest.groupId);
  if (!group?.token) return null;

  const view = buildRsvpView(snapshot, group.token, {
    lang,
    dietaryOptions,
    allowDietaryOther,
  });
  if (view.kind !== "form") return null;

  return { view, selfGuestId: guest.guestId };
}
