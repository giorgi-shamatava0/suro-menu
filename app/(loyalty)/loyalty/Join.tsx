"use client";
import { activationCopy } from "@/lib/loyalty/activation-copy";
import { useState, useRef, useEffect } from "react";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function Join({ lang }: { lang: CustomerLanguage }) {
  const t = customerCopy[lang];
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
  async function join() {
    if (lock.current || !consent) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/loyalty/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: "2026-11-23" }),
      });
      if (!response.ok) {
        setError(response.status === 503 ? t.unavailable : t.failed);
        return;
      }
      const result = await response.json();
      try {
        sessionStorage.setItem("suro-welcome", result.code);
      } catch {}
      window.location.assign(`/c/${result.code}?welcome=1`);
    } catch {
      setError(t.connection);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="customer-join" aria-busy={busy}>
      <label className="activation-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        <span>
          {a.consent}{" "}
          <a
            href={`/loyalty/legal?lang=${lang}`}
            target="_blank"
            rel="noopener"
          >
            {a.terms} · {a.privacy}
          </a>
        </span>
      </label>
      <button
        className="loyalty-primary"
        onClick={join}
        disabled={busy || !consent}
      >
        {busy && <span className="loyalty-spinner" aria-hidden="true" />}
        {busy ? t.creating : t.create}
      </button>
      {error && (
        <p className="loyalty-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
