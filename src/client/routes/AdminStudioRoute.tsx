import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ApiError, weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { createStudioDocument } from "@/client/studio/document";
import { ErrorRoute, LoadingRoute } from "./RouteState";

/** Uses the existing signed, HTTP-only admin session; never stores a password. */
function StudioLogin({ onLogin }: { onLogin: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const passphrase = String(new FormData(form).get("passphrase") ?? "");
    setPending(true);
    setError("");
    try {
      await weddingApi.adminLogin(passphrase);
      form.reset();
      onLogin();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401
        ? "Incorrect passphrase."
        : "Sign-in failed. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return <main className="mx-auto max-w-sm px-6 py-16">
    <Link to="/admin" className="text-sm text-gold underline">← Admin dashboard</Link>
    <h1 className="mt-6 font-display text-3xl text-ink">Glass House Studio</h1>
    <p className="mt-3 text-sm text-muted">Sign in with your existing administrator passphrase. Guest data is not included in the public application source.</p>
    <form onSubmit={submit} className="mt-6">
      <label htmlFor="studio-passphrase" className="text-xs text-muted">Administrator passphrase</label>
      <input id="studio-passphrase" name="passphrase" type="password" autoComplete="current-password" required maxLength={500} className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3" />
      {error && <p role="alert" className="mt-3 text-sm text-blush-deep">{error}</p>}
      <button type="submit" disabled={pending} className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-cream disabled:opacity-60">{pending ? "Signing in…" : "Open studio"}</button>
    </form>
  </main>;
}

export default function AdminStudioRoute() {
  const { lang } = useLanguage();
  const [revision, setRevision] = useState(0);
  const access = useApiResource(`studio-access:${lang}:${revision}`, () => weddingApi.adminSummary(lang));
  const frame = useRef<HTMLIFrameElement>(null);
  const [document] = useState(() => createStudioDocument(window.location.origin));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "tongter-studio:ready") setReady(true);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    if (access.state !== "ready") setReady(false);
  }, [access.state]);

  async function importSiteGuests() {
    if (!ready || busy || !frame.current?.contentWindow) return;
    setBusy(true);
    setNotice("");
    try {
      const source = await weddingApi.adminStudioGuests();
      if (source.status === "unconfigured" || source.guests.length === 0) {
        setNotice("No site guests are available. Use Guests → Import, or Files → Import layout, inside the studio.");
        return;
      }
      frame.current?.contentWindow?.postMessage({
        type: "tongter-studio:import-guests",
        text: JSON.stringify(source),
      }, window.location.origin);
      setNotice(source.status === "stale"
        ? "The site returned its cached roster. Review the import preview before applying. Nothing is written to Sheets."
        : "Review the import preview inside the studio. Nothing is written to Sheets.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setRevision(value => value + 1);
        setNotice("Your session expired. Sign in again; your browser draft is retained.");
      } else {
        setNotice("Unable to load site guests. Your local draft is unchanged; saved JSON/CSV imports still work.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (access.state === "loading") return <LoadingRoute lang={lang} />;
  if (access.state === "unauthorized") return <StudioLogin onLogin={() => setRevision(value => value + 1)} />;
  if (access.state !== "ready") return <ErrorRoute lang={lang} />;

  return <main className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-paper" aria-label="Administrator seating studio">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs text-muted">
      <Link to="/admin" className="text-gold underline">← Dashboard</Link>
      <span>Local draft · does not update live Google Sheets or RSVP seats</span>
      <button type="button" onClick={importSiteGuests} disabled={!ready || busy} className="rounded-full border border-line px-3 py-2 text-ink disabled:opacity-50">
        {busy ? "Loading roster…" : "Import site guests (preview)"}
      </button>
    </div>
    {notice && <p role="status" className="shrink-0 border-b border-line bg-gold-soft px-3 py-2 text-xs text-ink">{notice}</p>}
    <iframe
      ref={frame}
      title="Glass House seating and guest studio"
      srcDoc={document}
      className="min-h-0 w-full flex-1 border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-pointer-lock"
      referrerPolicy="no-referrer"
    />
  </main>;
}
