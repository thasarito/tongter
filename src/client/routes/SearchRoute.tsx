import { Link, useSearchParams } from "react-router";
import GuestSearch from "@/components/GuestSearch";
import SiteHeader from "@/components/SiteHeader";
import StatusNotice from "@/components/StatusNotice";
import { weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { t } from "@/shared/i18n";
import { ErrorRoute, LoadingRoute } from "./RouteState";

export function SearchRoute() {
  const { lang } = useLanguage();
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const resource = useApiResource(`search:${query}:${lang}`, () =>
    weddingApi.search(query, lang),
  );
  if (resource.state === "loading") return <LoadingRoute lang={lang} />;
  if (resource.state !== "ready") return <ErrorRoute lang={lang} />;
  const view = resource.data;
  const copy = t(lang);

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-20 pt-6">
        <StatusNotice status={view.status} lang={lang} />
        <h1 className="font-display text-4xl text-ink">{copy.search.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{copy.search.subtitle}</p>
        <GuestSearch key={query} lang={lang} initialQuery={view.query} />
        <div className="mt-10">
          {view.state === "too-short" && <p className="text-sm text-muted">{copy.search.minChars}</p>}
          {view.state === "no-results" && (
            <div className="rounded-xl border border-line bg-paper px-5 py-6 text-center">
              <p className="text-sm text-ink">{copy.search.noResults}</p>
              <p className="mt-1 text-sm text-muted">{copy.search.noResultsHint}</p>
            </div>
          )}
          {view.state === "results" && (
            <>
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted">{copy.search.resultsTitle}</h2>
              <ul className="mt-4 space-y-2">
                {view.results.map((result) => {
                  const detail = `${copy.common.table} ${result.tableId}${result.groupLabel ? ` · ${copy.search.inGroup} ${result.groupLabel}` : ""}`;
                  return result.href ? (
                    <li key={result.guestId}>
                      <Link to={result.href} className="flex items-center justify-between rounded-xl border border-line bg-paper px-5 py-4 transition hover:border-gold">
                        <span><span className="block text-ink">{result.name}</span><span className="mt-0.5 block text-xs text-muted">{detail}</span></span>
                        <span aria-hidden className="text-gold">→</span>
                      </Link>
                    </li>
                  ) : (
                    <li key={result.guestId} className="rounded-xl border border-line bg-paper px-5 py-4 text-sm text-muted">{result.name} · {detail}</li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </main>
    </>
  );
}
