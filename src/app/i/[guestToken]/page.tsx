import NotFoundCard from "@/components/NotFoundCard";
import SiteHeader from "@/components/SiteHeader";
import GuestJourney from "@/components/journey/GuestJourney";
import { allowDietaryOther, dietaryOptions } from "@/lib/config";
import { getLang } from "@/lib/lang";
import { findGuestByToken, getSnapshot } from "@/lib/sheets";
import { buildJourneyIntroView, buildRsvpView } from "@/shared/views";

export const metadata = { title: "RSVP", robots: { index: false } };

/**
 * A guest's personal invite link.
 *
 * Identifies exactly one person, so the journey opens straight onto their own
 * card — no envelope, no side, no name picking. The journey also writes the
 * identity to localStorage, so later visits from the same phone skip ahead too.
 */
export default async function PersonalInvitePage({
  params,
}: {
  params: Promise<{ guestToken: string }>;
}) {
  const [lang, { guestToken }] = await Promise.all([getLang(), params]);
  const snapshot = await getSnapshot();
  const guest = findGuestByToken(snapshot, guestToken);

  if (!guest) {
    return (
      <>
        <SiteHeader lang={lang} />
        <NotFoundCard lang={lang} status={snapshot.status} />
      </>
    );
  }

  const group = snapshot.groups.find((g) => g.groupId === guest.groupId);
  const view = group?.token
    ? buildRsvpView(snapshot, group.token, { lang, dietaryOptions, allowDietaryOther })
    : null;

  if (!view || view.kind !== "form") {
    return (
      <>
        <SiteHeader lang={lang} />
        <NotFoundCard lang={lang} status={snapshot.status} />
      </>
    );
  }

  return (
    <GuestJourney
      lang={lang}
      intro={buildJourneyIntroView(snapshot, lang)}
      initialFlow={{ view, selfGuestId: guest.guestId }}
    />
  );
}
