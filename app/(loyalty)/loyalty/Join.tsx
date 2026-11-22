"use client";
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
        window.location.replace(`/loyalty/card/${code}`);
    } catch {}
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function join() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/loyalty/enroll", { method: "POST" });
      if (!response.ok) {
        setError(response.status === 503 ? t.unavailable : t.failed);
        return;
      }
      window.location.reload();
    } catch {
      setError(t.connection);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="customer-join" aria-busy={busy}>
      <button className="loyalty-primary" onClick={join} disabled={busy}>
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
