import Link from "next/link";
import LangToggle from "./LangToggle";
import { event } from "@/lib/config";
import { pick, type Lang } from "@/shared/i18n";

export default function SiteHeader({ lang }: { lang: Lang }) {
  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10">
      <Link
        href="/"
        className="font-display text-lg tracking-wide text-ink transition hover:text-gold"
      >
        {pick(lang, event.bride)} &amp; {pick(lang, event.groom)}
      </Link>
      <LangToggle lang={lang} />
    </header>
  );
}
