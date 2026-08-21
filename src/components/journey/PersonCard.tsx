"use client";

import { t, type Lang } from "@/shared/i18n";
import type { DietaryOptionView, RsvpGuestView } from "@/shared/views";

/**
 * One person's RSVP: coming or not, what they can eat, and a note.
 *
 * Uncontrolled inputs named from the view model, so the whole group's answers
 * live in one enclosing <form> and get submitted together — a guest can walk
 * forward and back through the group without any of it being lost, and a
 * partial form is a valid submission.
 *
 * Only the current person is mounted visibly; the others stay in the DOM but
 * hidden, which is what keeps their entered values in the form data.
 */
export default function PersonCard({
  guest,
  lang,
  dietaryOptions,
  allowDietaryOther,
  hidden,
  position,
  total,
  isSelf,
}: {
  guest: RsvpGuestView;
  lang: Lang;
  dietaryOptions: DietaryOptionView[];
  allowDietaryOther: boolean;
  hidden: boolean;
  position: number;
  total: number;
  isSelf: boolean;
}) {
  const copy = t(lang);
  const selected = new Set(guest.dietary.selected);

  return (
    <fieldset
      // `hidden` keeps the inputs in the form while removing them from view and
      // from the tab order.
      hidden={hidden}
      className="w-full"
    >
      <legend className="sr-only">{guest.name}</legend>

      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          {isSelf ? copy.journey.yourTurn : copy.journey.alsoInGroup}
          {total > 1 ? ` · ${copy.journey.personOf} ${position}/${total}` : ""}
        </p>
        <h2 className="mt-3 font-display text-4xl text-ink">{guest.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {copy.common.table} {guest.tableId} · {copy.common.seat}{" "}
          {guest.seatIndex}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((value) => (
          <label
            key={value}
            className="cursor-pointer rounded-2xl border border-line bg-paper px-4 py-4 text-center text-sm text-muted transition has-checked:border-rose has-checked:bg-rose-mist has-checked:text-ink hover:border-rose/60"
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
            {value === "yes" ? copy.rsvp.attending : copy.rsvp.notAttending}
          </label>
        ))}
      </div>

      {dietaryOptions.length > 0 && (
        <fieldset className="mt-7">
          <legend className="text-xs uppercase tracking-[0.15em] text-muted">
            {copy.rsvp.dietaryLabel}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {dietaryOptions.map((option) => (
              <label
                key={option.id}
                className="cursor-pointer rounded-full border border-line bg-paper px-4 py-2 text-sm text-muted transition has-checked:border-rose has-checked:bg-rose-mist has-checked:text-ink hover:border-rose/60"
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
          placeholder={copy.rsvp.dietaryPlaceholder}
          aria-label={`${copy.rsvp.dietaryOther} — ${guest.name}`}
          maxLength={500}
          className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-rose"
        />
      )}

      <div className="mt-7">
        <label
          htmlFor={guest.fieldNames.note}
          className="block text-xs uppercase tracking-[0.15em] text-muted"
        >
          {copy.rsvp.messageLabel}
        </label>
        <textarea
          id={guest.fieldNames.note}
          name={guest.fieldNames.note}
          rows={3}
          defaultValue={guest.note}
          maxLength={500}
          placeholder={copy.rsvp.messagePlaceholder}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-rose"
        />
      </div>
    </fieldset>
  );
}
