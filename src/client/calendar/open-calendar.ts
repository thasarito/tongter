import type { Lang } from "@/shared/i18n";

const LIFF_SDK_SRC = "https://static.line-scdn.net/liff/edge/2/sdk.js";
const LINE_USER_AGENT = /\bLine\/[\d.]+/i;

export type CalendarKind = "google" | "apple";
export type CalendarRuntime = "liff" | "line-in-app" | "external";

export interface LiffApi {
  init(config: { liffId: string }): Promise<void>;
  isInClient(): boolean;
  openWindow(config: { url: string; external?: boolean }): void;
}

declare global {
  interface Window {
    liff?: LiffApi;
  }
}

let sdkPromise: Promise<LiffApi> | null = null;
let initialized:
  | { liffId: string; promise: Promise<LiffApi | null> }
  | null = null;

function isLineUserAgent(userAgent: string): boolean {
  return LINE_USER_AGENT.test(userAgent);
}

function loadLiffSdk(): Promise<LiffApi> {
  if (window.liff) return Promise.resolve(window.liff);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${LIFF_SDK_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");

    const loaded = () => {
      if (window.liff) resolve(window.liff);
      else reject(new Error("LIFF SDK loaded without exposing window.liff"));
    };
    const failed = () => reject(new Error("LIFF SDK failed to load"));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });

    if (!existing) {
      script.src = LIFF_SDK_SRC;
      script.async = true;
      document.head.append(script);
    }
  });

  return sdkPromise;
}

export function calendarEndpointHref(kind: CalendarKind, lang: Lang): string {
  const endpoint =
    kind === "google" ? "/api/calendar/google" : "/calendar/apple";
  const params = new URLSearchParams({
    lang,
    openExternalBrowser: "1",
  });
  return `${endpoint}?${params.toString()}`;
}

export function detectCalendarRuntime(
  liff: LiffApi | null,
  userAgent: string =
    typeof navigator === "undefined" ? "" : navigator.userAgent,
): CalendarRuntime {
  try {
    if (liff?.isInClient()) return "liff";
  } catch {
    // A failed LIFF environment check degrades to the LINE user-agent hint.
  }

  return isLineUserAgent(userAgent) ? "line-in-app" : "external";
}

export async function initializeCalendarLiff(
  rawLiffId: string | undefined,
): Promise<LiffApi | null> {
  const liffId = rawLiffId?.trim();
  if (!liffId || typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  if (!window.liff && !isLineUserAgent(navigator.userAgent)) return null;
  if (initialized?.liffId === liffId) return initialized.promise;

  const promise = loadLiffSdk()
    .then(async (liff) => {
      await liff.init({ liffId });
      return liff;
    })
    .catch(() => null);

  initialized = { liffId, promise };
  return promise;
}

export function handoffCalendarClick(
  event: { preventDefault(): void },
  href: string,
  liff: LiffApi | null,
): CalendarRuntime {
  const runtime = detectCalendarRuntime(liff);

  if (runtime === "liff" && liff) {
    event.preventDefault();
    liff.openWindow({
      url: new URL(href, window.location.href).toString(),
      external: true,
    });
  }

  // Ordinary LINE in-app browsers follow the anchor unchanged. Its URL already
  // carries LINE's documented openExternalBrowser=1 flag. External browsers
  // likewise use the normal anchor navigation.
  return runtime;
}
