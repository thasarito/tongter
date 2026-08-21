"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/_actions/set-lang";
import { t, type Lang } from "@/shared/i18n";

/**
 * Two-language switch. Writes a cookie server-side and refreshes so every
 * server-rendered string flips at once — no client-side translation state.
 */
export default function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const next: Lang = lang === "th" ? "en" : "th";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLang(next, pathname);
          router.refresh();
        })
      }
      className="rounded-full border border-line px-3 py-1 text-xs tracking-wide text-muted transition hover:border-gold hover:text-ink disabled:opacity-50"
      aria-label={`Switch language to ${next === "th" ? "Thai" : "English"}`}
    >
      {t(lang).common.switchTo}
    </button>
  );
}
