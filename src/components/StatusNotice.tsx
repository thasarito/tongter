import { t, type Lang } from "@/lib/i18n";
import type { SnapshotStatus } from "@/lib/sheets";

/**
 * Shown when the guest list cannot be trusted: either the sheet was never
 * connected, or a refresh failed and cached data is being served. Both are
 * soft states — the page still renders.
 */
export default function StatusNotice({
  status,
  lang,
}: {
  status: SnapshotStatus;
  lang: Lang;
}) {
  const copy = t(lang).errors;
  if (status === "ok") return null;

  const isUnconfigured = status === "unconfigured";

  return (
    <div
      role="status"
      className="mx-auto mb-8 max-w-xl rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm"
    >
      <p className="font-medium text-ink">
        {isUnconfigured ? copy.unconfiguredTitle : copy.staleNotice}
      </p>
      {isUnconfigured && (
        <p className="mt-1 text-muted">{copy.unconfiguredBody}</p>
      )}
    </div>
  );
}
