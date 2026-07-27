import { NextResponse } from "next/server";

// Used by the container healthcheck, which cloudflared waits on before starting.
// Deliberately does not touch Google Sheets: the container is healthy if it can
// serve, even when Sheets is unreachable.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
