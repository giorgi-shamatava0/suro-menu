"use client";
import { activationCopy } from "@/lib/loyalty/activation-copy";
import { signupPinCopy } from "@/lib/loyalty/signup-pin-copy";
import LegalContent from "./LegalContent";
import { useState, useRef, useEffect } from "react";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function Join({
  lang,
  terms,
}: {
  lang: CustomerLanguage;
  terms?: string;
}) {
  const t = customerCopy[lang];
  const dialog = useRef<HTMLDialogElement>(null);
  const pinDialog = useRef<HTMLDialogElement>(null);
  const pinInput = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const p = signupPinCopy[lang];
  useEffect(() => {
    try {
      const code = localStorage.getItem("suro-card-code");
      if (code && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{22})$/.test(code))
        window.location.replace(`/c/${code}`);
    } catch {}
  }, []);
  const [consent, setConsent] = useState(false);
  const a = activationCopy[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const enrollment = useRef<AbortController | null>(null);
  useEffect(() => () => enrollment.current?.abort(), []);
  useEffect(() => {
    if (!busy && pinDialog.current?.open) pinInput.current?.focus();
  }, [busy]);
  async function join(staffPin?: string) {
    if (lock.current || !consent) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      enrollment.current = new AbortController();
      const response = await fetch("/api/loyalty/enroll", {
        method: "POST",
        signal: enrollment.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: "2026-11-23",
          ...(staffPin ? { pin: staffPin } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          typeof result.code === "string" &&
          result.code.startsWith("STAFF_PIN_")
        ) {
          setPinError(
            result.code === "STAFF_PIN_INVALID"
              ? p.invalid
              : result.code === "STAFF_PIN_LOCKED"
                ? p.locked.replace(
                    "{time}",
                    new Date(result.resetsAt).toLocaleTimeString(
                      lang === "ka"
                        ? "ka-GE"
                        : lang === "ru"
                          ? "ru-RU"
                          : "en-GB",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tbilisi",
                      },
                    ),
                  )
                : result.code === "STAFF_PIN_NOT_CONFIGURED"
                  ? p.unconfigured
                  : "",
          );
          setPin("");
          if (!pinDialog.current?.open) pinDialog.current?.showModal();
          pinInput.current?.focus();
        } else if (pinDialog.current?.open)
          setPinError(response.status === 503 ? t.unavailable : t.failed);
        else setError(response.status === 503 ? t.unavailable : t.failed);
        return;
      }
      setPin("");
      pinDialog.current?.close();
      try {
        sessionStorage.setItem("suro-welcome", result.code);
      } catch {}
      window.location.assign(`/c/${result.code}?welcome=1`);
    } catch {
      if (pinDialog.current?.open) setPinError(t.connection);
      else setError(t.connection);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="customer-join" aria-busy={busy}>
      <div className="activation-consent">
        <input
          id="activation-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-label={
            {
              ka: "ვეთანხმები პირობებსა და კონფიდენციალურობის შეტყობინებას",
              en: "I accept the terms and privacy notice",
              ru: "Я принимаю условия и уведомление о конфиденциальности",
            }[lang]
          }
        />
        <span>
          <label htmlFor="activation-consent">
            {
              { ka: "ვეთანხმები", en: "I accept the", ru: "Я принимаю" }[lang]
            }{" "}
          </label>
          <button
            type="button"
            className="consent-terms-link"
            onClick={() => dialog.current?.showModal()}
          >
            {
              {
                ka: "პირობებსა და კონფიდენციალურობის შეტყობინებას.",
                en: "terms and privacy notice.",
                ru: "условия и уведомление о конфиденциальности.",
              }[lang]
            }
          </button>
        </span>
      </div>
      <dialog
        ref={dialog}
        className="terms-dialog"
        aria-label={`${a.terms} · ${a.privacy}`}
      >
        <header>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={{ ka: "დახურვა", en: "Close", ru: "Закрыть" }[lang]}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <LegalContent lang={lang} terms={terms} />
      </dialog>
      <button
        className="loyalty-primary"
        onClick={() => void join()}
        disabled={busy || !consent}
      >
        {busy && <span className="loyalty-spinner" aria-hidden="true" />}
        {busy ? t.creating : t.create}
      </button>
      <dialog
        ref={pinDialog}
        className="signup-pin-dialog"
        aria-labelledby="signup-pin-title"
        aria-describedby="signup-pin-explanation"
        onClose={() => {
          setPin("");
          setPinError("");
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void join(pin);
          }}
        >
          <h2 id="signup-pin-title">{p.title}</h2>
          <p id="signup-pin-explanation">{p.explanation}</p>
          <label htmlFor="signup-staff-pin">{p.label}</label>
          <input
            ref={pinInput}
            id="signup-staff-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/[^0-9]/g, ""));
              setPinError("");
            }}
            required
            disabled={busy}
            aria-describedby={pinError ? "signup-pin-error" : undefined}
            aria-invalid={!!pinError}
          />
          {pinError && (
            <p id="signup-pin-error" className="loyalty-error" role="alert">
              {pinError}
            </p>
          )}
          <button
            className="loyalty-primary"
            type="submit"
            disabled={busy || pin.length !== 6}
          >
            {busy ? t.creating : p.submit}
          </button>
          <button
            className="signup-pin-cancel"
            type="button"
            disabled={busy}
            onClick={() => pinDialog.current?.close()}
          >
            {p.cancel}
          </button>
        </form>
      </dialog>
      {error && (
        <p className="loyalty-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
