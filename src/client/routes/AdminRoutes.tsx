import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import QRCode from "qrcode";
import { weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { event } from "@/shared/event-config";
import type { AdminView, QrSheetView } from "@/shared/views";
import { ErrorRoute, LoadingRoute } from "./RouteState";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(false);
    try {
      const data = new FormData(event.currentTarget);
      await weddingApi.adminLogin(String(data.get("passphrase") ?? ""));
      onLogin();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mx-auto max-w-sm px-6 py-20">
      <h1 className="font-display text-3xl text-ink">Admin</h1>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="passphrase" className="text-xs uppercase tracking-[0.15em] text-muted">Passphrase</label>
        <input id="passphrase" name="passphrase" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-gold" />
        {error && <p role="alert" className="mt-3 text-sm text-blush-deep">Incorrect passphrase.</p>}
        <button type="submit" disabled={pending} className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-sm text-cream transition hover:bg-gold disabled:opacity-60">{pending ? "Checking…" : "Sign in"}</button>
      </form>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border border-line bg-paper px-5 py-4"><p className="text-xs uppercase tracking-[0.15em] text-muted">{label}</p><p className="mt-2 font-display text-3xl text-ink">{value}</p>{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}</div>;
}

function Dashboard({ view, refresh, logout }: { view: AdminView; refresh: () => Promise<void>; logout: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const action = (work: () => Promise<void>) => async () => { setPending(true); try { await work(); } finally { setPending(false); } };
  const { totals } = view;
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">RSVP dashboard</h1>
        <div className="flex items-center gap-3"><span className="text-xs text-muted">{view.fetchedAt ? `Synced ${new Date(view.fetchedAt).toLocaleTimeString("en-GB")}` : "Never synced"}</span><button type="button" disabled={pending} onClick={action(refresh)} className="rounded-full border border-line px-4 py-1.5 text-xs text-muted">{pending ? "Syncing…" : "Sync now"}</button><button type="button" onClick={action(logout)} className="rounded-full border border-line px-4 py-1.5 text-xs text-muted">Sign out</button></div>
      </div>
      {view.status !== "ok" && <p className="mt-6 rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm text-ink">{view.status === "unconfigured" ? "Not connected to Google Sheets." : "Serving cached data; the last refresh failed."}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Attending" value={totals.attending} /><Stat label="Declined" value={totals.declined} /><Stat label="No response" value={totals.noResponse} /><Stat label="Groups replied" value={`${totals.groupsReplied}/${totals.groupsTotal}`} /></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Stat label="Seats filled" value={`${totals.seatsNamed}/${totals.seatsTotal}`} hint={`${totals.seatsTotal - totals.seatsNamed} unassigned seat(s)`} /><div className="rounded-xl border border-line bg-paper px-5 py-4"><p className="text-xs uppercase tracking-[0.15em] text-muted">Print</p><Link to="/admin/qr" className="mt-2 inline-block font-display text-xl text-gold underline">QR cards for all {totals.groupsTotal} groups →</Link></div></div>
      {view.warnings.length > 0 && <section className="mt-10"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">Sheet warnings ({view.warnings.length})</h2><ul className="mt-3 space-y-1.5 rounded-xl border border-blush-deep/30 bg-blush-soft px-5 py-4 text-sm">{view.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
      <section className="mt-10"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">By table</h2><div className="mt-3 overflow-x-auto rounded-xl border border-line bg-paper"><table className="w-full min-w-[34rem] text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="px-5 py-2.5">Table</th><th className="px-5 py-2.5">Seats</th><th className="px-5 py-2.5">Named</th><th className="px-5 py-2.5">Attending</th><th className="px-5 py-2.5">Declined</th></tr></thead><tbody>{view.tables.map((table) => <tr key={table.tableId} className="border-b border-line/60"><td className="px-5 py-2.5">{table.tableId} <span className="text-xs text-muted">{table.shape}</span></td><td className="px-5 py-2.5">{table.seats}</td><td className="px-5 py-2.5">{table.named}</td><td className="px-5 py-2.5">{table.attending}</td><td className="px-5 py-2.5">{table.declined}</td></tr>)}</tbody></table></div></section>
      {view.dietaryTotals.length > 0 && <section className="mt-10"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">Dietary totals</h2><ul className="mt-3 flex flex-wrap gap-2">{view.dietaryTotals.map((item) => <li key={item.label} className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm">{item.label} <span className="font-display text-gold">{item.count}</span></li>)}</ul></section>}
      {view.dietary.length > 0 && <section className="mt-8"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">Dietary by guest ({view.dietary.length})</h2><ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper">{view.dietary.map((item) => <li key={item.name + item.notes.join()} className="flex justify-between gap-4 px-5 py-3"><span>{item.name}</span><span className="text-muted">{item.notes.join(", ")}</span></li>)}</ul></section>}
      {view.messages.length > 0 && <section className="mt-10"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">Messages ({view.messages.length})</h2><ul className="mt-3 space-y-3">{view.messages.map((message) => <li key={message.at + message.from} className="rounded-xl border border-line bg-paper px-5 py-4"><p>{message.text}</p><p className="mt-2 text-xs text-muted">— {message.from}</p></li>)}</ul></section>}
      <section className="mt-10"><h2 className="text-xs uppercase tracking-[0.2em] text-muted">Groups ({view.groups.length})</h2><div className="mt-3 overflow-x-auto rounded-xl border border-line bg-paper"><table className="w-full min-w-[40rem] text-sm"><tbody>{view.groups.map((group) => <tr key={group.groupId} className="border-b border-line/60"><td className="px-5 py-2.5">{group.label}<span className="ml-2 text-xs text-muted">{group.groupId}</span></td><td className="px-5 py-2.5 text-muted">{group.memberNames.join(", ")}</td><td className="px-5 py-2.5">{group.state} ({group.answered}/{group.total})</td><td className="px-5 py-2.5"><Link to={group.href} className="text-gold underline">{group.token}</Link></td></tr>)}</tbody></table></div></section>
    </main>
  );
}

export function AdminRoute() {
  const { lang } = useLanguage();
  const [revision, setRevision] = useState(0);
  const resource = useApiResource(`admin:${lang}:${revision}`, () => weddingApi.adminSummary(lang));
  if (resource.state === "loading") return <LoadingRoute lang={lang} />;
  if (resource.state === "unauthorized") return <AdminLogin onLogin={() => setRevision((value) => value + 1)} />;
  if (resource.state !== "ready") return <ErrorRoute lang={lang} />;
  return <Dashboard view={resource.data} refresh={async () => { await weddingApi.adminSync(); setRevision((value) => value + 1); }} logout={async () => { await weddingApi.adminLogout(); setRevision((value) => value + 1); }} />;
}

function QrCards({ view }: { view: QrSheetView }) {
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    Promise.all(view.cards.map(async (card) => [card.groupId, await QRCode.toString(card.url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2f2a26", light: "#00000000" } })] as const)).then((entries) => { if (active) setSvgs(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [view]);
  return <main className="mx-auto w-full max-w-5xl px-6 py-10"><div className="flex items-center justify-between print:hidden"><div><h1 className="font-display text-3xl text-ink">QR cards</h1><p className="mt-2 text-sm text-muted">{view.cards.length} groups · one card per group.</p></div><Link to="/admin" className="rounded-full border border-line px-4 py-1.5 text-xs text-muted">← Dashboard</Link></div><div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">{view.cards.map((card) => <article key={card.groupId} className="flex break-inside-avoid flex-col items-center rounded-2xl border border-line bg-paper px-6 py-7 text-center"><p className="font-display text-lg text-ink">{event.bride.en} &amp; {event.groom.en}</p><p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted">ตอบรับคำเชิญ · RSVP</p><div className="mt-4 h-36 w-36 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svgs[card.groupId] ?? "" }} /><p className="mt-4 text-sm text-ink">{card.label}</p><p className="mt-1 text-xs text-muted">{card.memberNames.join(" · ") || "—"}</p><p className="mt-3 break-all text-[0.65rem] text-muted">{card.url}</p></article>)}</div></main>;
}

export function AdminQrRoute() {
  const { lang } = useLanguage();
  const [revision, setRevision] = useState(0);
  const resource = useApiResource(`qr:${lang}:${revision}`, () => weddingApi.adminQr(lang));
  if (resource.state === "loading") return <LoadingRoute lang={lang} />;
  if (resource.state === "unauthorized") return <AdminLogin onLogin={() => setRevision((value) => value + 1)} />;
  if (resource.state !== "ready") return <ErrorRoute lang={lang} />;
  return <QrCards view={resource.data} />;
}
