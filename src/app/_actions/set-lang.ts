"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, isLang } from "@/shared/i18n";

/** Persists the language choice for a year and re-renders the current page. */
export async function setLang(next: string, pathname: string) {
  if (!isLang(next)) return;

  const store = await cookies();
  store.set(LANG_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath(pathname || "/");
}
