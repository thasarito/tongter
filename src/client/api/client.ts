import type { Lang } from "@/shared/i18n";
import type {
  AdminView,
  JourneyIntroView,
  QrSheetView,
  RsvpFormView,
  SearchView,
  SeatView,
} from "@/shared/views";
import { hc } from "hono/client";
import type { AppType } from "@/worker/app";

export const api = hc<AppType>(window.location.origin, {
  init: { credentials: "include" },
});

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

const query = (lang: Lang) => `lang=${lang}`;

export interface PersonFlow {
  view: RsvpFormView;
  selfGuestId: string;
}

export const weddingApi = {
  intro: (lang: Lang) => getJson<JourneyIntroView>(`/api/journey?${query(lang)}`),
  search: (value: string, lang: Lang) =>
    getJson<SearchView>(`/api/search?q=${encodeURIComponent(value)}&${query(lang)}`),
  person: (guestId: string, lang: Lang) =>
    postJson<PersonFlow>("/api/journey/person", { guestId, lang }),
  personalInvite: (guestToken: string, lang: Lang) =>
    getJson<{ intro: JourneyIntroView; flow: PersonFlow }>(
      `/api/journey/${encodeURIComponent(guestToken)}?${query(lang)}`,
    ),
  groupInvite: (token: string, lang: Lang) =>
    getJson<{
      intro: JourneyIntroView;
      choices: { guestId: string; name: string }[];
      view: RsvpFormView;
    }>(`/api/rsvp/${encodeURIComponent(token)}?${query(lang)}`),
  seat: (token: string, search: string, lang: Lang) =>
    getJson<{ view: SeatView; debug: boolean }>(
      `/api/seat/${encodeURIComponent(token)}?${query(lang)}&${search.replace(/^\?/, "")}`,
    ),
  submitRsvp: (token: string, body: unknown) =>
    postJson<{ ok: true; seatHref: string }>(
      `/api/rsvp/${encodeURIComponent(token)}`,
      body,
    ),
  adminLogin: (passphrase: string) =>
    postJson<void>("/api/admin/login", { passphrase }),
  adminLogout: () => postJson<void>("/api/admin/logout"),
  adminSync: () => postJson<void>("/api/admin/sync"),
  adminSummary: (lang: Lang) =>
    getJson<AdminView>(`/api/admin/summary?${query(lang)}`),
  adminQr: (lang: Lang) =>
    getJson<QrSheetView>(`/api/admin/qr?${query(lang)}`),
};
