import type { Lang } from "@/shared/i18n";
import type { RsvpFormView } from "@/shared/views";

export interface RsvpPayload {
  submittedBy: string;
  lang: Lang;
  answers: Array<{
    guestId: string;
    attending: boolean;
    dietary: string[];
    dietaryOther: string;
    note: string;
  }>;
}

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : "";

export function rsvpPayloadFromForm(
  view: RsvpFormView,
  submittedBy: string,
  lang: Lang,
  form: FormData,
): RsvpPayload {
  return {
    submittedBy,
    lang,
    answers: view.guests.flatMap((guest) => {
      const attending = form.get(guest.fieldNames.attending);
      if (attending !== "yes" && attending !== "no") return [];
      return [{
        guestId: guest.guestId,
        attending: attending === "yes",
        dietary: form
          .getAll(guest.fieldNames.dietary)
          .filter((value): value is string => typeof value === "string"),
        dietaryOther: text(form.get(guest.fieldNames.dietaryOther)),
        note: text(form.get(guest.fieldNames.note)),
      }];
    }),
  };
}
