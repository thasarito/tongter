import GuestJourney from "@/components/journey/GuestJourney";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildJourneyIntroView } from "@/shared/views";

/**
 * The full ceremony: envelope, logo, invitation, then the RSVP flow.
 *
 * Everything after this point is client-side stage changes rather than
 * navigation, so the sequence never blinks through a page load.
 */
export default async function Home() {
  const lang = await getLang();
  const snapshot = await getSnapshot();
  const intro = buildJourneyIntroView(snapshot, lang);

  return <GuestJourney lang={lang} intro={intro} />;
}
