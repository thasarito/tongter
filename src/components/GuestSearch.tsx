"use client";

import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/shared/i18n";

/**
 * Search input for the guest list.
 *
 * The surrounding form is a plain GET to /rsvp, so the page still works with
 * JavaScript disabled. When JS is available, typing debounces into a router
 * replace, which re-renders the server-side results without a full navigation.
 */
export default function GuestSearch({
  lang,
  initialQuery,
}: {
  lang: Lang;
  initialQuery: string;
}) {
  const copy = t(lang).search;
  const navigate = useNavigate();
  const [value, setValue] = useState(initialQuery);
  // Skips the first effect run so landing on /rsvp?q=... does not immediately
  // replace the URL it was just given.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const id = setTimeout(() => {
      const query = value.trim();
      navigate(query ? `/rsvp?q=${encodeURIComponent(query)}` : "/rsvp", {
        replace: true,
      });
    }, 300);
    return () => clearTimeout(id);
  }, [value, navigate]);

  return (
    <form action="/rsvp" method="get" className="mt-8">
      <label htmlFor="q" className="sr-only">
        {copy.title}
      </label>
      <div className="flex gap-2">
        <input
          id="q"
          name="q"
          type="search"
          autoComplete="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.placeholder}
          className="w-full rounded-full border border-line bg-paper px-5 py-3 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-gold"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-ink px-6 py-3 text-sm text-cream transition hover:bg-gold"
        >
          {copy.title}
        </button>
      </div>
    </form>
  );
}
