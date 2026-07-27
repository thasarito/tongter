import NotFoundCard from "@/components/NotFoundCard";
import RsvpForm from "@/components/RsvpForm";
import SiteHeader from "@/components/SiteHeader";
import StatusNotice from "@/components/StatusNotice";
import { allowDietaryOther, dietaryOptions } from "@/lib/config";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildRsvpView } from "@/lib/views";

export const metadata = { title: "RSVP" };

export default async function GroupRsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [lang, { token }] = await Promise.all([getLang(), params]);
  const snapshot = await getSnapshot();
  const view = buildRsvpView(snapshot, token, {
    lang,
    dietaryOptions,
    allowDietaryOther,
  });

  if (view.kind === "not-found") {
    return (
      <>
        <SiteHeader lang={lang} />
        <NotFoundCard lang={lang} status={view.status} />
      </>
    );
  }

  const copy = t(lang);

  return (
    <>
      <SiteHeader lang={lang} />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-20 pt-6">
        <StatusNotice status={view.status} lang={lang} />

        <h1 className="font-display text-4xl text-ink">{copy.rsvp.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {view.groupLabel ? `${view.groupLabel} · ` : ""}
          {copy.rsvp.groupIntro}
        </p>

        {view.hasResponded && (
          <div className="mt-6 rounded-xl border border-line bg-paper px-5 py-4 text-sm">
            <p className="text-ink">{copy.rsvp.alreadyRespondedTitle}</p>
            <p className="mt-1 text-muted">{copy.rsvp.alreadyRespondedBody}</p>
          </div>
        )}

        <RsvpForm view={view} lang={lang} />
      </main>
    </>
  );
}
