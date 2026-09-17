import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError, weddingApi } from "@/client/api/client";
import "./admin-passcode.css";

const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["0", ""],
] as const;
const DIGITS = 4;

export function AdminPasscodeScreen({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const screenRef = useRef<HTMLElement>(null);
  const codeRef = useRef("");
  const requestRef = useRef<AbortController | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    screenRef.current?.focus({ preventScroll: true });
    return () => { requestRef.current?.abort(); };
  }, []);

  async function checkCode(candidate: string) {
    // A ref closes the gap before React renders disabled keys, including rapid taps.
    if (requestRef.current || !/^\d{4}$/.test(candidate)) return;
    const request = new AbortController();
    requestRef.current = request;
    setPending(true);
    screenRef.current?.focus({ preventScroll: true });
    try {
      await weddingApi.adminLogin(candidate, request.signal);
      if (request.signal.aborted) return;
      codeRef.current = "";
      setCode("");
      onLogin();
    } catch (cause) {
      if (request.signal.aborted) return;
      codeRef.current = "";
      setCode("");
      setError(cause instanceof ApiError && cause.status === 401
        ? "Incorrect passcode. Try again."
        : "Unable to connect. Please try again.");
      screenRef.current?.focus({ preventScroll: true });
    } finally {
      if (!request.signal.aborted) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  function updateCode(next: string) {
    if (requestRef.current || !/^\d{0,4}$/.test(next)) return;
    codeRef.current = next;
    setCode(next);
    setError("");
    if (next.length === DIGITS) void checkCode(next);
  }
  function addDigit(digit: string) { updateCode(codeRef.current + digit); }
  function removeDigit() { updateCode(codeRef.current.slice(0, -1)); }
  function cancel() {
    requestRef.current?.abort();
    codeRef.current = "";
    setCode("");
    void navigate("/", { replace: true });
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) addDigit(event.key);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      removeDigit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    // Tab, Enter and Space retain normal button/keyboard accessibility.
  }
  function onPaste(event: ClipboardEvent<HTMLElement>) {
    const value = event.clipboardData.getData("text").trim();
    event.preventDefault();
    if (/^\d{4}$/.test(value)) updateCode(value);
  }
  const canDelete = code.length > 0 && !pending;

  return (
    <main ref={screenRef} className="passcode-screen" lang="en" tabIndex={-1}
      aria-labelledby="passcode-title" onKeyDown={onKeyDown} onPaste={onPaste}>
      <div className="passcode-panel">
        <header className="passcode-header">
          <p className="passcode-eyebrow">Administrator access</p>
          <h1 id="passcode-title">Enter Passcode</h1>
          <div className="passcode-dots" data-invalid={Boolean(error)} aria-hidden="true">
            {Array.from({ length: DIGITS }, (_, index) => (
              <span key={index} data-passcode-dot data-filled={index < code.length} />
            ))}
          </div>
          <div className="passcode-feedback">
            <p role="status" aria-live="polite" aria-atomic="true">
              <span className="passcode-sr-only">{code.length} of {DIGITS} digits entered.</span>
              {pending && <span>Checking…</span>}
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
        </header>
        <div className="passcode-pad">
          <div className="passcode-keys" role="group" aria-label="Numeric keypad" aria-busy={pending}>
            {KEYS.map(([digit, letters]) => (
              <button key={digit} type="button" className="passcode-key" data-digit={digit}
                aria-label={digit} disabled={pending} onClick={() => addDigit(digit)}>
                <span className="passcode-digit" aria-hidden="true">{digit}</span>
                {letters && <span className="passcode-letters" aria-hidden="true">{letters}</span>}
              </button>
            ))}
          </div>
          <div className="passcode-actions">
            <button type="button" className="passcode-action" onClick={canDelete ? removeDigit : cancel}>
              {canDelete ? "Delete" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
