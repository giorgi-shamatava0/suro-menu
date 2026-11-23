"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import CardActions from "./CardActions";
import Loading from "./LoadingState";
import WelcomeAnimation from "./WelcomeAnimation";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import QRCode from "qrcode";
import RewardCard from "./RewardCard";
import { api } from "@/convex/_generated/api";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function LiveCard({
  code,
  lang: initialLang,
  initialCard,
  welcome = false,
}: {
  code: string;
  lang: CustomerLanguage;
  initialCard?: FunctionReturnType<typeof api.loyalty.publicCard>;
  welcome?: boolean;
}) {
  const lang = useCustomerLanguage(initialLang);
  const t = customerCopy[lang];
  const liveCard = useQuery(api.loyalty.publicCard, { code });
  const card = liveCard === undefined ? initialCard : liveCard;
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [welcomeProgress, setWelcomeProgress] = useState<number | null>(
    welcome ? 0 : null,
  );
  useEffect(() => {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = `/api/loyalty/manifest/${card?.publicCode ?? code}`;
    document.head.append(manifest);
    return () => manifest.remove();
  }, [code, card?.publicCode]);
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
  if (card === undefined) return <Loading />;
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
      {card.programs.some(
        (p) => p.id === card.welcomeProgramId && p.stamps >= 1,
      ) && (
        <WelcomeAnimation
          code={card.publicCode ?? code}
          lang={lang}
          welcomeStamps={card.welcomeStamps}
          onProgress={setWelcomeProgress}
        />
      )}
      <div id="download-card" className="download-card">
        {card.programs.map((p) => (
          <RewardCard
            key={p.id}
            lang={lang}
            title={card.programs.length > 1 ? p.name : t.cardHeading}
            name={
              p.rewardNames?.[lang] ||
              p.rewardNames?.ka ||
              p.rewardNames?.en ||
              p.rewardNames?.ru ||
              p.reward
            }
            description={
              p.rewardDescriptions?.[lang] ||
              p.rewardDescriptions?.ka ||
              p.rewardDescriptions?.en ||
              p.rewardDescriptions?.ru
            }
            image={p.rewardImageUrl}
            qr={qr}
            scanLabel={t.scan}
            stamps={
              welcomeProgress !== null && p.id === card.welcomeProgramId
                ? welcomeProgress
                : p.stamps
            }
            threshold={p.threshold}
            animateStamp={
              p.id === card.welcomeProgramId ? welcomeProgress : null
            }
          />
        ))}
        {card.rewards.map((r) => (
          <RewardCard
            key={r.id}
            lang={lang}
            title={t.cardHeading}
            earned
            celebrationKey={r.id}
            name={
              r.rewardNames?.[lang] ||
              r.rewardNames?.ka ||
              r.rewardNames?.en ||
              r.rewardNames?.ru ||
              r.label
            }
            description={
              r.rewardDescriptions?.[lang] ||
              r.rewardDescriptions?.ka ||
              r.rewardDescriptions?.en ||
              r.rewardDescriptions?.ru
            }
            image={r.rewardImageUrl}
            qr={qr}
            scanLabel={t.scan}
          />
        ))}
        {card.programs.length === 0 && card.rewards.length === 0 && (
          <section className="loyalty-card live-stamp-card">
            <p>{t.empty}</p>
            {qr && (
              <img
                className="loyalty-qr"
                src={qr}
                width={96}
                height={96}
                alt={t.scan}
              />
            )}
          </section>
        )}
        {error && (
          <p className="loyalty-error" role="alert">
            {error}
          </p>
        )}
        <div className="stamp-card-meta">
          <a
            className="stamp-card-terms-button"
            href={`/loyalty/legal?lang=${lang}`}
          >
            {t.terms}
          </a>
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
        </div>
      </div>
      <CardActions
        lang={lang}
        qr={qr}
        cardCode={card.publicCode ?? code}
        ready={welcomeProgress === null}
      />
    </main>
  );
}
