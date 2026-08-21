import NotFoundCard from "@/components/NotFoundCard";
import SiteHeader from "@/components/SiteHeader";
import { t, type Lang } from "@/shared/i18n";

export function LoadingRoute({ lang }: { lang: Lang }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-sm text-muted">
      {t(lang).common.loading}
    </main>
  );
}

export function MissingRoute({ lang }: { lang: Lang }) {
  return (
    <>
      <SiteHeader lang={lang} />
      <NotFoundCard lang={lang} status="ok" />
    </>
  );
}

export function ErrorRoute({ lang }: { lang: Lang }) {
  const copy = t(lang).rsvp;
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">{copy.errorTitle}</h1>
        <p className="mt-2 text-sm text-muted">{copy.errorBody}</p>
      </div>
    </main>
  );
}
