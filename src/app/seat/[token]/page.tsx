import NotFoundCard from "@/components/NotFoundCard";
import SeatReveal from "@/components/SeatReveal";
import SiteHeader from "@/components/SiteHeader";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildSeatView } from "@/lib/views";

export const metadata = { title: "Your seat", robots: { index: false } };

/**
 * The seat reveal.
 *
 * No site header above the scene: it takes the full viewport, and a chrome bar
 * on top of a doorway you are about to walk through breaks the illusion. The
 * usual header returns below the fold, with the details.
 */
export default async function SeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ celebrate?: string; guest?: string; debug?: string }>;
}) {
  const [lang, { token }, query] = await Promise.all([
    getLang(),
    params,
    searchParams,
  ]);

  const snapshot = await getSnapshot();
  const view = buildSeatView(snapshot, token, lang, {
    celebrate: query.celebrate === "1",
    preferGuestId: query.guest,
  });

  if (view.kind === "not-found") {
    return (
      <>
        <SiteHeader lang={lang} />
        <NotFoundCard lang={lang} status={view.status} />
      </>
    );
  }

  return <SeatReveal view={view} lang={lang} debug={query.debug === "1"} />;
}
