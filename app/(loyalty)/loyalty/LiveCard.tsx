"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import QRCode from "qrcode";
import StampGrid from "@/components/loyalty/StampGrid";
import { api } from "@/convex/_generated/api";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function LiveCard({
  code,
  lang: initialLang,
}: {
  code: string;
  lang: CustomerLanguage;
}) {
  const lang = useCustomerLanguage(initialLang);
  const t = customerCopy[lang];
  const card = useQuery(api.loyalty.publicCard, { code });
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  useEffect(() => {
    const url = `${location.origin}/c/${card?.publicCode ?? code}`;
    void QRCode.toDataURL(url, {
      width: 430,
      margin: 3,
      errorCorrectionLevel: "L",
    })
      .then(setQr)
      .catch(() => setError(t.failed));
  }, [code, card?.publicCode, t.failed]);
  useEffect(() => {
    if (card && !card.revoked) {
      try {
        localStorage.setItem("suro-card-code", code);
      } catch {}
    } else if (card === null || card?.revoked) {
      try {
        if (localStorage.getItem("suro-card-code") === code)
          localStorage.removeItem("suro-card-code");
      } catch {}
    }
  }, [card, code]);
  const expiryDate = (at: number) => {
    const local = new Date(at + 4 * 3600_000);
    return `${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}/${String(local.getUTCFullYear()).slice(-2)}`;
  };
  const giftLabel = (program: {
    reward: string;
    rewardNames?: { ka?: string; en?: string; ru?: string };
  }) => {
    const item =
      program.rewardNames?.[lang] ||
      program.rewardNames?.ka ||
      program.rewardNames?.en ||
      program.rewardNames?.ru ||
      program.reward;
    return t.rewardGift.replace("{item}", item);
  };
  if (card === undefined)
    return (
      <main className="loyalty-main" aria-live="polite">
        {t.loading}
      </main>
    );
  if (!card || card.revoked)
    return (
      <main className="loyalty-main">
        <h1>{card?.revoked ? t.revoked : t.notFound}</h1>
        <p>{t.help}</p>
        <a href="/loyalty">Suro</a>
      </main>
    );
  return (
    <main className="loyalty-main customer-main customer-card-main" lang={lang}>
      <h1 className="card-accessible-title">{t.title}</h1>
      <section className="loyalty-card live-stamp-card" aria-label={t.card}>
        <div className="stamp-card-brand">
          <span className="stamp-card-title">{t.cardHeading}</span>
          {card.programs.length === 1 && (
            <p
              className="stamp-card-total"
              aria-label={t.progress
                .replace("{count}", String(card.programs[0].stamps))
                .replace("{total}", String(card.programs[0].threshold))}
            >
              {card.programs[0].stamps}
              <span className="stamp-card-total-slash">/</span>
              <span className="stamp-card-total-limit">
                {card.programs[0].threshold}
              </span>
            </p>
          )}
        </div>
        <div aria-live="polite">
          {card.programs.map((p) => (
            <div key={p.id} className="live-card-program">
              {card.programs.length > 1 && (
                <div className="stamp-card-program-label">
                  <span>{p.name}</span>
                  <strong>
                    {p.stamps}/{p.threshold}
                  </strong>
                </div>
              )}
              <StampGrid
                threshold={p.threshold}
                stamps={p.stamps}
                rewardImageUrl={p.rewardImageUrl}
              />
            </div>
          ))}
          {card.rewards.map((r, i) => (
            <p className="loyalty-reward" key={i}>
              {r.rewardNames?.[lang] ||
                r.rewardNames?.ka ||
                r.rewardNames?.en ||
                r.rewardNames?.ru ||
                r.label}
            </p>
          ))}
        </div>
        <footer className="stamp-card-footer">
          <div className="stamp-card-footer-copy">
            {card.programs.map((p) => (
              <div key={p.id}>
                <p className="stamp-card-reward">{giftLabel(p)}</p>
              </div>
            ))}
            {card.programs.length === 0 && (
              <p className="stamp-card-reward">{t.empty}</p>
            )}
          </div>
          {qr && (
            <img
              className="loyalty-qr"
              src={qr}
              width={88}
              height={88}
              alt={t.scan}
            />
          )}
        </footer>
        {error && (
          <p className="loyalty-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div className="stamp-card-meta">
        <div className="stamp-card-expiry-list">
          {card.programs
            .filter((p) => p.expiresAt && p.stamps > 0)
            .map((p) => (
              <p className="stamp-card-expiry" key={p.id}>
                {card.programs.length > 1 && `${p.name} · `}
                {expiryDate(p.expiresAt!)}
              </p>
            ))}
        </div>
        <button
          type="button"
          className="stamp-card-terms-button"
          aria-expanded={termsOpen}
          aria-controls="card-terms"
          onClick={() => setTermsOpen(!termsOpen)}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" />
            <path d="M10 9v5" stroke="currentColor" strokeLinecap="round" />
            <circle cx="10" cy="6.5" r=".8" fill="currentColor" />
          </svg>
          {t.terms}
        </button>
      </div>
      {termsOpen && (
        <section id="card-terms" className="stamp-card-terms-panel">
          <h2>{t.terms}</h2>
          <p>
            {card.terms?.[lang] ||
              card.terms?.ka ||
              card.terms?.en ||
              card.terms?.ru ||
              t.termsEmpty}
          </p>
        </section>
      )}
    </main>
  );
}
