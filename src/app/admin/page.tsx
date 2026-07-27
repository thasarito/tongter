import Link from "next/link";
import AdminActions from "@/components/admin/AdminActions";
import AdminLogin from "@/components/admin/AdminLogin";
import { isAdmin, isAdminConfigured } from "@/lib/admin-auth";
import { allowDietaryOther, dietaryOptions } from "@/lib/config";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildAdminView } from "@/lib/views";

export const metadata = { title: "Admin", robots: { index: false } };

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-5 py-4">
      <p className="text-xs uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLogin configured={isAdminConfigured()} />;
  }

  const lang = await getLang();
  const snapshot = await getSnapshot();
  const view = buildAdminView(snapshot, {
    lang,
    dietaryOptions,
    allowDietaryOther,
  });
  const { totals } = view;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">RSVP dashboard</h1>
        <AdminActions fetchedAt={view.fetchedAt} />
      </div>

      {view.status !== "ok" && (
        <p className="mt-6 rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm text-ink">
          {view.status === "unconfigured"
            ? "Not connected to Google Sheets — set GOOGLE_SHEET_ID and the service account credentials."
            : "Serving cached data; the last refresh failed."}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Attending" value={totals.attending} />
        <Stat label="Declined" value={totals.declined} />
        <Stat label="No response" value={totals.noResponse} />
        <Stat
          label="Groups replied"
          value={`${totals.groupsReplied}/${totals.groupsTotal}`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat
          label="Seats filled"
          value={`${totals.seatsNamed}/${totals.seatsTotal}`}
          hint={
            totals.seatsNamed < totals.seatsTotal
              ? `${totals.seatsTotal - totals.seatsNamed} seat(s) have no name in the sheet`
              : "Every seat on the plan has a guest"
          }
        />
        <div className="rounded-xl border border-line bg-paper px-5 py-4">
          <p className="text-xs uppercase tracking-[0.15em] text-muted">Print</p>
          <Link
            href="/admin/qr"
            className="mt-2 inline-block font-display text-xl text-gold underline underline-offset-4 hover:text-ink"
          >
            QR cards for all {totals.groupsTotal} groups →
          </Link>
        </div>
      </div>

      {/* Sheet problems are worth surfacing loudly: a bad seat reference means a
          guest silently vanishes from the site. */}
      {view.warnings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
            Sheet warnings ({view.warnings.length})
          </h2>
          <ul className="mt-3 space-y-1.5 rounded-xl border border-blush-deep/30 bg-blush-soft px-5 py-4 text-sm">
            {view.warnings.map((w) => (
              <li key={w} className="text-ink">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">By table</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-5 py-2.5 font-medium">Table</th>
                <th className="px-5 py-2.5 font-medium">Seats</th>
                <th className="px-5 py-2.5 font-medium">Named</th>
                <th className="px-5 py-2.5 font-medium">Attending</th>
                <th className="px-5 py-2.5 font-medium">Declined</th>
              </tr>
            </thead>
            <tbody>
              {view.tables.map((table) => (
                <tr key={table.tableId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-5 py-2.5">
                    {table.tableId}
                    <span className="ml-2 text-xs text-muted">{table.shape}</span>
                  </td>
                  <td className="px-5 py-2.5 text-muted">{table.seats}</td>
                  <td className="px-5 py-2.5">{table.named}</td>
                  <td className="px-5 py-2.5">{table.attending}</td>
                  <td className="px-5 py-2.5 text-muted">{table.declined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {view.dietaryTotals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
            Dietary totals
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {view.dietaryTotals.map((entry) => (
              <li
                key={entry.label}
                className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm"
              >
                {entry.label}
                <span className="ml-2 font-display text-base text-gold">
                  {entry.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.dietary.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
            Dietary by guest ({view.dietary.length})
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper">
            {view.dietary.map((d) => (
              <li
                key={d.name + d.notes.join()}
                className="flex justify-between gap-4 px-5 py-3"
              >
                <span className="text-ink">{d.name}</span>
                <span className="text-right text-muted">{d.notes.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.messages.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
            Messages ({view.messages.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {view.messages.map((m) => (
              <li
                key={m.at + m.from}
                className="rounded-xl border border-line bg-paper px-5 py-4"
              >
                <p className="text-sm leading-relaxed text-ink">{m.text}</p>
                <p className="mt-2 text-xs text-muted">— {m.from}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Groups ({view.groups.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-5 py-2.5 font-medium">Group</th>
                <th className="px-5 py-2.5 font-medium">People</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {view.groups.map((group) => (
                <tr key={group.groupId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-5 py-2.5">
                    {group.label}
                    <span className="ml-2 text-xs text-muted">{group.groupId}</span>
                  </td>
                  <td className="px-5 py-2.5 text-muted">
                    {group.memberNames.join(", ") || "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        group.state === "none"
                          ? "text-muted"
                          : group.state === "partial"
                            ? "text-gold"
                            : "text-ink"
                      }
                    >
                      {group.state === "none"
                        ? "No response"
                        : group.state === "partial"
                          ? `Partial (${group.answered}/${group.total})`
                          : "Replied"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <Link
                      href={group.href}
                      className="text-gold underline underline-offset-4 hover:text-ink"
                    >
                      {group.token}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
