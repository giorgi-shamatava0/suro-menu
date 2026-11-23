"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./RewardCard.module.css";
import StampGrid from "@/components/loyalty/StampGrid";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";

const copy = {
  en: {
    view: "View reward",
    back: "Back to stamps",
    earned: "Yours to enjoy",
    redeem: "Redeem your reward",
    scan: "Show at the café",
  },
  ka: {
    view: "ნახე საჩუქარი",
    back: "უკან დაბრუნება",
    earned: "შენი საჩუქარი",
    redeem: "მიიღე საჩუქარი",
    scan: "აჩვენე კაფეში",
  },
  ru: {
    view: "Посмотреть подарок",
    back: "К отметкам",
    earned: "Ваш подарок",
    redeem: "Получите подарок",
    scan: "Покажите в кафе",
  },
};

export default function RewardCard({
  lang,
  title,
  name,
  description,
  image,
  qr,
  scanLabel,
  stamps = 0,
  threshold = 8,
  animateStamp = null,
  earned = false,
  celebrationKey,
}: {
  lang: CustomerLanguage;
  title: string;
  name: string;
  description?: string;
  image?: string | null;
  qr: string;
  scanLabel: string;
  stamps?: number;
  threshold?: number;
  animateStamp?: number | null;
  earned?: boolean;
  celebrationKey?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const t = copy[lang];
  const complete = earned || stamps >= threshold;
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!complete) return;
    const storageKey = celebrationKey
      ? `suro-reward-seen:${celebrationKey}`
      : null;
    try {
      if (storageKey && sessionStorage.getItem(storageKey)) return;
    } catch {
      /* A blocked storage setting must not hide reward feedback. */
    }
    setCelebrating(true);
    const timer = window.setTimeout(() => {
      setCelebrating(false);
      try {
        if (storageKey) sessionStorage.setItem(storageKey, "1");
      } catch {}
    }, 1800);
    return () => {
      window.clearTimeout(timer);
      setCelebrating(false);
    };
  }, [complete, celebrationKey]);
  return (
    <section
      className={styles.scene}
      data-flipped={flipped}
      data-complete={complete}
      data-celebrating={celebrating}
      aria-label={name}
    >
      <span className={styles.announcement} role="status">
        {complete ? `${t.redeem}: ${name}` : ""}
      </span>
      <div className={styles.turn}>
        <button
          type="button"
          className={styles.front}
          data-card-front
          data-threshold={threshold}
          data-earned={earned}
          tabIndex={flipped ? -1 : 0}
          aria-hidden={flipped}
          aria-label={`${complete ? t.redeem : `${title}: ${stamps} / ${threshold}`}. ${complete ? t.scan : t.view}: ${name}`}
          onClick={() => setFlipped(true)}
        >
          <CardFrontContent
            lang={lang}
            title={title}
            name={name}
            stamps={stamps}
            threshold={threshold}
            animateStamp={animateStamp}
            earned={earned}
            complete={complete}
            celebrating={celebrating}
          />
        </button>
        <div
          className={styles.back}
          data-card-back
          inert={!flipped}
          aria-hidden={!flipped}
        >
          <div
            className={styles.photo}
            data-has-image={Boolean(image && !imageFailed)}
          >
            {image && !imageFailed ? (
              <img
                src={image}
                alt={name}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className={styles.fallback} aria-hidden="true">
                <i className="stamp-impression" />
              </span>
            )}
            <button
              type="button"
              className={styles.return}
              data-card-return
              onClick={() => setFlipped(false)}
              aria-label={t.back}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
          </div>
          <div className={styles.scan}>
            {qr && (
              <img
                className="loyalty-qr"
                src={qr}
                alt={scanLabel}
                width={216}
                height={216}
              />
            )}
            <span>{t.scan}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

type FrontProps = {
  lang: CustomerLanguage;
  title: string;
  name: string;
  stamps: number;
  threshold: number;
  animateStamp?: number | null;
  earned?: boolean;
  complete: boolean;
  celebrating?: boolean;
};
function CardFrontContent({
  lang,
  title,
  name,
  stamps,
  threshold,
  animateStamp,
  earned,
  complete,
  celebrating,
}: FrontProps) {
  const t = copy[lang];
  return (
    <>
      {" "}
      <span className={styles.heading}>{complete ? t.redeem : title}</span>
      {celebrating && (
        <span className={styles.celebration} aria-hidden="true">
          <span className={styles.glint} />
          {Array.from({ length: 8 }, (_, i) => (
            <i
              key={i}
              className={styles.spark}
              style={{ "--spark": i } as CSSProperties}
            />
          ))}
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.stamps}>
          {earned ? (
            <span className={styles.earnedSeal} aria-hidden="true">
              <i className="stamp-impression" />
            </span>
          ) : (
            <StampGrid
              stamps={stamps}
              threshold={threshold}
              animateStamp={animateStamp}
            />
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.name}>{name}</span>
        <span className={styles.cue}>
          {complete ? t.scan : t.view}
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </span>
      </div>
    </>
  );
}
export function LoyaltyCardSample(
  props: Omit<FrontProps, "complete" | "celebrating">,
) {
  return (
    <section className={styles.scene} data-sample aria-label={props.title}>
      <div className={styles.front}>
        <CardFrontContent
          {...props}
          complete={props.stamps >= props.threshold}
        />
      </div>
    </section>
  );
}
