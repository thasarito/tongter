import NotFoundCard from "@/components/NotFoundCard";
import SeatReveal from "@/components/SeatReveal";
import SiteHeader from "@/components/SiteHeader";
import StatusNotice from "@/components/StatusNotice";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildSeatView } from "@/lib/views";

export const metadata = { title: "Your seat" };

export default async function SeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ celebrate?: string; guest?: string }>;
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

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="flex-1">
        <StatusNotice status={view.status} lang={lang} />
        <SeatReveal view={view} lang={lang} />
      </main>
    </>
  );
}
