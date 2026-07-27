"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "@/app/_actions/admin";

export default function AdminLogin({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(
    adminLogin,
    {},
  );

  return (
    <div className="mx-auto max-w-sm px-6 py-20">
      <h1 className="font-display text-3xl text-ink">Admin</h1>

      {!configured ? (
        <p className="mt-4 rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm text-muted">
          ADMIN_PASSPHRASE is not set, so the dashboard is locked. Add it to
          <code className="mx-1">.env</code> and restart.
        </p>
      ) : (
        <form action={formAction} className="mt-6">
          <label htmlFor="passphrase" className="text-xs uppercase tracking-[0.15em] text-muted">
            Passphrase
          </label>
          <input
            id="passphrase"
            name="passphrase"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
          />
          {state.error && (
            <p role="alert" className="mt-3 text-sm text-blush-deep">
              Incorrect passphrase.
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-sm text-cream transition hover:bg-gold disabled:opacity-60"
          >
            {pending ? "Checking…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
