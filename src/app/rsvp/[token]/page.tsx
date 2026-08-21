import NotFoundCard from "@/components/NotFoundCard";
import SiteHeader from "@/components/SiteHeader";
import GuestJourney from "@/components/journey/GuestJourney";
import { displayName, findGroupByToken, getSnapshot, guestsInGroup } from "@/lib/sheets";
import { getLang } from "@/lib/lang";
import { buildJourneyIntroView } from "@/lib/views";

export const metadata = { title: "RSVP", robots: { index: false } };

/**
 * A group's invite link — the 54 QR codes already printed.
 *
 * The token identifies the group but not the person, so the journey opens on a
 * short "which one are you?" list of just those names, then continues exactly
 * as a personal link would.
 */
export default async function GroupRsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [lang, { token }] = await Promise.all([getLang(), params]);
  const snapshot = await getSnapshot();
  const group = findGroupByToken(snapshot, token);

  if (!group) {
    return (
      <>
        <SiteHeader lang={lang} />
        <NotFoundCard lang={lang} status={snapshot.status} />
      </>
    );
  }

  const choices = guestsInGroup(snapshot, group.groupId).map((g) => ({
    guestId: g.guestId,
    name: displayName(g, lang),
  }));

  return (
    <GuestJourney
      lang={lang}
      intro={buildJourneyIntroView(snapshot, lang)}
      groupChoices={choices}
    />
  );
}
