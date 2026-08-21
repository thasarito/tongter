import Link from "next/link";
import QRCode from "qrcode";
import AdminLogin from "@/components/admin/AdminLogin";
import { isAdmin, isAdminConfigured } from "@/lib/admin-auth";
import { event, siteUrl } from "@/lib/config";
import { getLang } from "@/lib/lang";
import { getSnapshot } from "@/lib/sheets";
import { buildQrSheetView } from "@/shared/views";

export const metadata = { title: "QR cards", robots: { index: false } };

/**
 * Printable QR card per group.
 *
 * Codes are rendered to inline SVG server-side, so the page prints identically
 * everywhere and needs no client JavaScript or network access at print time.
 */
export default async function QrPage() {
  if (!(await isAdmin())) {
    return <AdminLogin configured={isAdminConfigured()} />;
  }

  const lang = await getLang();
  const snapshot = await getSnapshot();
  const view = buildQrSheetView(snapshot, lang, siteUrl);

  const cards = await Promise.all(
    view.cards.map(async (card) => ({
      ...card,
      svg: await QRCode.toString(card.url, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#2f2a26", light: "#00000000" },
      }),
    })),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-3xl text-ink">QR cards</h1>
          <p className="mt-2 text-sm text-muted">
            {cards.length} groups · one card per group, two per row. Each code
            opens that group&apos;s RSVP page directly.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-gold hover:text-ink"
        >
          ← Dashboard
        </Link>
      </div>

      {cards.length === 0 && (
        <p className="mt-8 rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm print:hidden">
          No groups in the sheet yet.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
        {cards.map((card) => (
          <article
            key={card.groupId}
            // break-inside-avoid keeps a card from being split across pages.
            className="flex break-inside-avoid flex-col items-center rounded-2xl border border-line bg-paper px-6 py-7 text-center print:rounded-none print:border-line/60"
          >
            <p className="font-display text-lg text-ink">
              {event.bride.en} &amp; {event.groom.en}
            </p>
            <p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted">
              ตอบรับคำเชิญ · RSVP
            </p>

            <div
              className="mt-4 h-36 w-36 [&>svg]:h-full [&>svg]:w-full"
              // qrcode emits a self-contained <svg> element.
              dangerouslySetInnerHTML={{ __html: card.svg }}
            />

            <p className="mt-4 text-sm text-ink">{card.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {card.memberNames.join(" · ") || "—"}
            </p>
            <p className="mt-3 break-all text-[0.65rem] text-muted">{card.url}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
