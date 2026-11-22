"use client";
import { useEffect, useState } from "react";
import Language from "@/app/(loyalty)/loyalty/Language";
import { adminText } from "@/lib/loyalty/admin-copy";
import {
  customerLanguage,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function Error({ reset }: { reset: () => void }) {
  const [lang, setLang] = useState<CustomerLanguage>("ka");
  useEffect(() => {
    const value = document.cookie
      .split("; ")
      .find((row) => row.startsWith("lang="))
      ?.split("=")[1];
    setLang(customerLanguage(value));
  }, []);
  const tr = (text: string) => adminText(lang, text);
  return (
    <div className="loyalty-shell admin-loyalty">
      <header className="customer-header">
        <span className="loyalty-mark" role="img" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <main className="loyalty-main admin-login" lang={lang}>
        <h1>{tr("Loyalty access unavailable.")}</h1>
        <p>{tr("Please sign in again.")}</p>
        <div className="loyalty-actions">
          <button onClick={reset}>{tr("Retry")}</button>
          <button
            onClick={() => {
              localStorage.removeItem("suro-admin");
              sessionStorage.removeItem("suro-loyalty-admin");
              window.location.reload();
            }}
          >
            {tr("Sign in again")}
          </button>
        </div>
      </main>
    </div>
  );
}
