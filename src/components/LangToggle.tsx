"use client";

import { useLanguage } from "@/client/app/LanguageProvider";
import { t, type Lang } from "@/shared/i18n";

/**
 * Two-language switch. Writes a cookie server-side and refreshes so every
 * server-rendered string flips at once — no client-side translation state.
 */
export default function LangToggle({ lang }: { lang: Lang }) {
  const { setLang } = useLanguage();
  const next: Lang = lang === "th" ? "en" : "th";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="rounded-full border border-line px-3 py-1 text-xs tracking-wide text-muted transition hover:border-gold hover:text-ink disabled:opacity-50"
      aria-label={`Switch language to ${next === "th" ? "Thai" : "English"}`}
    >
      {t(lang).common.switchTo}
    </button>
  );
}
