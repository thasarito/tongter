"use client";

import { useTransition } from "react";
import { adminLogout, adminSync } from "@/app/_actions/admin";

export default function AdminActions({ fetchedAt }: { fetchedAt: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">
        {fetchedAt > 0
          ? `Synced ${new Date(fetchedAt).toLocaleTimeString("en-GB")}`
          : "Never synced"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => adminSync())}
        className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-gold hover:text-ink disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      <button
        type="button"
        onClick={() => startTransition(() => adminLogout())}
        className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-gold hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
