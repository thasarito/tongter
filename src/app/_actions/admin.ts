"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  adminTokenFor,
  checkPassphrase,
} from "@/lib/admin-auth";
import { invalidateSnapshot } from "@/lib/sheets";

export interface AdminLoginState {
  error?: boolean;
}

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const candidate = formData.get("passphrase");
  if (typeof candidate !== "string" || !checkPassphrase(candidate)) {
    return { error: true };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, adminTokenFor(candidate), {
    path: "/admin",
    httpOnly: true,
    sameSite: "lax",
    // Set only over HTTPS in production; plain HTTP in local development.
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });

  revalidatePath("/admin");
  return {};
}

export async function adminLogout() {
  const store = await cookies();
  store.delete({ name: ADMIN_COOKIE, path: "/admin" });
  revalidatePath("/admin");
}

/** Drops the 45s read cache so the next page load re-reads the sheet. */
export async function adminSync() {
  invalidateSnapshot();
  revalidatePath("/admin");
}
