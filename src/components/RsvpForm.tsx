"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitRsvp, type RsvpFormState } from "@/app/_actions/submit-rsvp";
import { t, type Lang } from "@/shared/i18n";
import type { RsvpFormView, RsvpGuestView } from "@/shared/views";

/**
 * The RSVP form.
 *
 * Reads everything from a view model — including the names of its own input
 * fields — so it holds no knowledge of the wire format, the sheet, or how
 * previous answers were resolved. Replacing this component is a pure styling
 * exercise.
 */

function SubmitButton({ lang }: { lang: Lang }) {
  const copy = t(lang).rsvp;
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink px-8 py-3.5 text-sm tracking-wide text-cream transition hover:bg-gold disabled:opacity-60"
    >
      {pending ? copy.submitting : copy.submit}
    </button>
  );
}

function GuestRow({
  guest,
  lang,
  dietaryOptions,
  allowDietaryOther,
}: {
  guest: RsvpGuestView;
  lang: Lang;
  dietaryOptions: RsvpFormView["dietaryOptions"];
  allowDietaryOther: boolean;
}) {
  const copy = t(lang).rsvp;
  const common = t(lang).common;
  const selected = new Set(guest.dietary.selected);

  return (
    <li className="border-b border-line px-5 py-5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-ink">{guest.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {common.table} {guest.tableId} · {common.seat} {guest.seatIndex}
          </p>
        </div>

        <div className="flex gap-2">
          {(["yes", "no"] as const).map((value) => (
            <label
              key={value}
              className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs text-muted transition has-checked:border-gold has-checked:bg-gold-soft has-checked:text-ink hover:border-gold/60"
            >
              <input
                type="radio"
                name={guest.fieldNames.attending}
                value={value}
                defaultChecked={
                  guest.attending !== null && guest.attending === (value === "yes")
                }
                className="sr-only"
              />
              {value === "yes" ? copy.attending : copy.notAttending}
            </label>
          ))}
        </div>
      </div>

      {dietaryOptions.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-xs text-muted">{copy.dietaryLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {dietaryOptions.map((option) => (
              <label
                key={option.id}
                className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs text-muted transition has-checked:border-blush-deep has-checked:bg-blush-soft has-checked:text-ink hover:border-gold/60"
              >
                <input
                  type="checkbox"
                  name={guest.fieldNames.dietary}
                  value={option.id}
                  defaultChecked={selected.has(option.id)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {allowDietaryOther && (
        <input
          type="text"
          name={guest.fieldNames.dietaryOther}
          defaultValue={guest.dietary.other}
          placeholder={copy.dietaryPlaceholder}
          aria-label={`${copy.dietaryOther} — ${guest.name}`}
          maxLength={500}
          className="mt-3 w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-gold"
        />
      )}

      <textarea
        name={guest.fieldNames.note}
        defaultValue={guest.note}
        rows={2}
        placeholder={copy.messagePlaceholder}
        aria-label={`${copy.messageLabel} — ${guest.name}`}
        maxLength={500}
        className="mt-3 w-full resize-y rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-gold"
      />
    </li>
  );
}

export default function RsvpForm({
  view,
  lang,
}: {
  view: RsvpFormView;
  lang: Lang;
}) {
  const copy = t(lang).rsvp;
  const [state, formAction] = useActionState<RsvpFormState, FormData>(
    submitRsvp,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name={view.fieldNames.token} value={view.token} />
      <input type="hidden" name={view.fieldNames.lang} value={lang} />

      <ul className="overflow-hidden rounded-2xl border border-line bg-paper">
        {view.guests.map((guest) => (
          <GuestRow
            key={guest.guestId}
            guest={guest}
            lang={lang}
            dietaryOptions={view.dietaryOptions}
            allowDietaryOther={view.allowDietaryOther}
          />
        ))}
      </ul>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="submittedBy"
            className="block text-xs uppercase tracking-[0.15em] text-muted"
          >
            {copy.submittedByLabel}
          </label>
          <input
            id="submittedBy"
            name={view.fieldNames.submittedBy}
            type="text"
            defaultValue={view.submittedBy}
            maxLength={500}
            className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-gold"
          />
        </div>

      </div>

      {state.status === "error" && state.errorKey && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-blush-deep/40 bg-blush-soft px-5 py-4 text-sm"
        >
          <p className="font-medium text-ink">{copy.errorTitle}</p>
          <p className="mt-1 text-muted">{copy[state.errorKey]}</p>
        </div>
      )}

      <div className="mt-8">
        <SubmitButton lang={lang} />
      </div>
    </form>
  );
}
