"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { loadPersonFlow, type PersonFlow } from "@/app/_actions/journey";
import { submitRsvp, type RsvpFormState } from "@/app/_actions/submit-rsvp";
import {
  forgetGuest,
  getIdentityServerSnapshot,
  getIdentitySnapshot,
  rememberGuest,
  subscribeIdentity,
} from "@/shared/identity";
import { t, type Lang } from "@/shared/i18n";
import type { Side } from "@/shared/types";
import type { JourneyIntroView, RsvpGuestView } from "@/shared/views";
import Envelope from "./Envelope";
import GateTransition from "./GateTransition";
import InvitationCard from "./InvitationCard";
import LogoReveal from "./LogoReveal";
import NamePicker from "./NamePicker";
import PersonCard from "./PersonCard";
import SidePicker from "./SidePicker";

/**
 * The guest journey, end to end.
 *
 * One component owns the whole sequence so nothing navigates mid-experience —
 * a page load between the envelope and the invitation would break the illusion
 * completely. Each stage is a plain render branch; the only asynchronous step
 * is resolving a chosen name into their group.
 *
 * Entry points hand it a different starting stage: `/` starts at the envelope,
 * a personal link starts at that guest's own card, a group link starts at
 * "which one are you?".
 */

type Stage =
  | "envelope"
  | "logo"
  | "invitation"
  | "side"
  | "name"
  | "rsvp"
  | "done";

export interface GuestJourneyProps {
  lang: Lang;
  intro: JourneyIntroView;
  /** Pre-resolved from a personal invite link. */
  initialFlow?: PersonFlow | null;
  /** Names to choose between, from a group invite link. */
  groupChoices?: { guestId: string; name: string }[];
}

export default function GuestJourney({
  lang,
  intro,
  initialFlow = null,
  groupChoices,
}: GuestJourneyProps) {
  const copy = t(lang);
  const router = useRouter();

  // A personal link skips straight to the RSVP; a group link starts at its own
  // short name list; otherwise the full ceremony.
  const [stage, setStage] = useState<Stage>(
    initialFlow ? "rsvp" : groupChoices ? "name" : "envelope",
  );
  const [side, setSide] = useState<Side | null>(null);
  const [flow, setFlow] = useState<PersonFlow | null>(initialFlow);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [pending, startTransition] = useTransition();

  // The browser owns this, not React: subscribe rather than copy it into state.
  const stored = useSyncExternalStore(
    subscribeIdentity,
    getIdentitySnapshot,
    getIdentityServerSnapshot,
  );
  // An arriving invite link supersedes whatever the device remembered.
  const remembered = initialFlow || groupChoices ? null : stored;

  const [submitState, formAction, submitting] = useActionState<RsvpFormState, FormData>(
    submitRsvp,
    { status: "idle" },
  );

  /*
   * The doors are shut for exactly as long as the submit is in flight.
   *
   * `pending` stays true through the sheet write *and* the redirect that
   * follows, so the navigation happens behind them; if the action comes back
   * with an error instead, it flips false and the doors reopen on the form. No
   * separate state, and no way for the two to disagree.
   */
  const closing = submitting;

  // A personal link is the one moment we learn exactly who this device is.
  useEffect(() => {
    if (!initialFlow) return;
    const self = initialFlow.view.guests.find(
      (g) => g.guestId === initialFlow.selfGuestId,
    );
    if (self) rememberGuest(self.guestId, self.name);
  }, [initialFlow]);

  const pickGuest = (guestId: string) => {
    setLoadError(false);
    startTransition(async () => {
      const next = await loadPersonFlow(guestId, lang);
      if (!next) {
        setLoadError(true);
        return;
      }
      const self = next.view.guests.find((g) => g.guestId === next.selfGuestId);
      if (self) rememberGuest(self.guestId, self.name);
      setFlow(next);
      setIndex(0);
      setStage("rsvp");
    });
  };

  /** The chosen guest first, then the rest of their group. */
  const ordered: RsvpGuestView[] = useMemo(() => {
    if (!flow) return [];
    const self = flow.view.guests.filter((g) => g.guestId === flow.selfGuestId);
    const others = flow.view.guests.filter((g) => g.guestId !== flow.selfGuestId);
    return [...self, ...others];
  }, [flow]);

  const pickerGuests = useMemo(() => {
    if (groupChoices) {
      const allowed = new Set(groupChoices.map((c) => c.guestId));
      return intro.guests.filter((g) => allowed.has(g.guestId));
    }
    if (!side) return intro.guests;
    return intro.guests.filter((g) => g.side === side);
  }, [intro.guests, side, groupChoices]);

  // --- Stages --------------------------------------------------------------

  if (stage === "envelope") {
    return <Envelope lang={lang} onOpened={() => setStage("logo")} />;
  }

  if (stage === "logo") {
    return <LogoReveal lang={lang} onDone={() => setStage("invitation")} />;
  }

  if (stage === "invitation") {
    return (
      <InvitationCard
        lang={lang}
        onContinue={() => {
          // A remembered guest skips side and name picking entirely.
          if (remembered) {
            pickGuest(remembered.guestId);
            return;
          }
          setStage("side");
        }}
      />
    );
  }

  if (stage === "side") {
    return (
      <SidePicker
        lang={lang}
        counts={intro.sideCounts}
        onPick={(chosen) => {
          setSide(chosen);
          setStage("name");
        }}
      />
    );
  }

  if (stage === "name" || (stage === "rsvp" && !flow)) {
    return (
      <div className="relative">
        <NamePicker
          lang={lang}
          guests={pickerGuests}
          searchable={pickerGuests}
          onPick={pickGuest}
          onBack={groupChoices ? undefined : () => setStage("side")}
        />
        {(pending || loadError) && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 flex justify-center px-6">
            <p className="rounded-full bg-paper/95 px-5 py-2 text-sm text-ink shadow-lg">
              {loadError ? copy.rsvp.errorBody : copy.common.loading}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (stage === "rsvp" && flow) {
    const isLast = index >= ordered.length - 1;

    return (
      <div className="min-h-dvh bg-cream px-6 py-12">
        <form action={formAction} className="mx-auto w-full max-w-md">
          <input
            type="hidden"
            name={flow.view.fieldNames.token}
            value={flow.view.token}
          />
          <input type="hidden" name={flow.view.fieldNames.lang} value={lang} />
          <input
            type="hidden"
            name={flow.view.fieldNames.submittedBy}
            value={ordered[0]?.name ?? ""}
          />

          {/*
            Every person stays mounted so their answers persist in the form as
            the guest steps back and forth; only the current one is visible.
          */}
          {ordered.map((guest, i) => (
            <PersonCard
              key={guest.guestId}
              guest={guest}
              lang={lang}
              dietaryOptions={flow.view.dietaryOptions}
              allowDietaryOther={flow.view.allowDietaryOther}
              hidden={i !== index}
              position={i + 1}
              total={ordered.length}
              isSelf={guest.guestId === flow.selfGuestId}
            />
          ))}

          {submitState.status === "error" && submitState.errorKey && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-blush-deep/40 bg-blush-soft px-5 py-4 text-sm"
            >
              <p className="font-medium text-ink">{copy.rsvp.errorTitle}</p>
              <p className="mt-1 text-muted">{copy.rsvp[submitState.errorKey]}</p>
            </div>
          )}

          <div className="mt-9 space-y-3">
            {!isLast && (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="w-full rounded-full border border-line bg-paper px-8 py-3.5 text-sm tracking-wide text-ink transition hover:border-rose"
              >
                {copy.journey.saveAndNext}
              </button>
            )}

            {/*
              Always available, on every card: nobody should have to answer for
              the whole group to record their own reply.
            */}
            <button
              type="submit"
              className="w-full rounded-full bg-rose px-8 py-3.5 text-sm tracking-wide text-white transition hover:bg-rose-deep"
            >
              {isLast ? copy.rsvp.submit : copy.journey.finishHere}
            </button>

            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="w-full py-2 text-sm text-muted underline underline-offset-4 transition hover:text-ink"
              >
                {copy.journey.back}
              </button>
            )}
          </div>
        </form>

        <div className="mx-auto mt-10 max-w-md text-center">
          <button
            type="button"
            onClick={() => {
              forgetGuest();
              setFlow(null);
              setSide(null);
              setStage("side");
              router.replace("/");
            }}
            className="text-xs text-muted underline underline-offset-4 transition hover:text-ink"
          >
            {copy.journey.notYou}
          </button>
        </div>

        <GateTransition closing={closing} lang={lang} />
      </div>
    );
  }

  return null;
}
