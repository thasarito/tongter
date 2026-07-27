import Link from "next/link";
import StatusNotice from "./StatusNotice";
import { t, type Lang } from "@/lib/i18n";
import type { SnapshotStatus } from "@/lib/types";

/** Shown when a token does not resolve to a group. */
export default function NotFoundCard({
  lang,
  status,
}: {
  lang: Lang;
  status: SnapshotStatus;
}) {
  const copy = t(lang).errors;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-20 pt-10 text-center">
      <StatusNotice status={status} lang={lang} />
      <h1 className="font-display text-3xl text-ink">{copy.notFoundTitle}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{copy.notFoundBody}</p>
      <Link
        href="/rsvp"
        className="mt-8 inline-block rounded-full bg-ink px-8 py-3 text-sm text-cream transition hover:bg-gold"
      >
        {copy.searchInstead}
      </Link>
    </main>
  );
}
