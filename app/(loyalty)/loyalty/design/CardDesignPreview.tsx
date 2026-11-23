"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { pick } from "@/lib/i18n";
import RewardCard from "../RewardCard";
import CustomerFrame from "../CustomerFrame";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
import styles from "./preview.module.css";

const rewards = {
  ka: "ბასკური ჩიზქეიქი",
  en: "Basque cheesecake",
  ru: "Баскский чизкейк",
};

export default function CardDesignPreview() {
  const menu = useQuery(api.menu.get, {});
  const product = menu?.sections
    .flatMap((s) => s.categories.flatMap((c) => c.items))
    .find((item) =>
      Object.values(item.name).some((n) => /basque|ბასკ|баск/i.test(n)),
    );
  const [threshold, setThreshold] = useState(8);
  const [stamps, setStamps] = useState(2);
  const [lang, setLang] = useState<CustomerLanguage>("ka");
  const [earned, setEarned] = useState(false);
  return (
    <CustomerFrame>
      <div className={styles.studio}>
        <header className={styles.heading}>
          <a
            href="/loyalty"
            aria-label="Suro loyalty"
            className="loyalty-mark"
          />
          <span>Card preview</span>
        </header>
        <main className={styles.layout}>
          <div className={styles.controls}>
            <fieldset>
              <legend>Stamp positions</legend>
              <div className={styles.counts}>
                {[4, 6, 8, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={threshold === count}
                    onClick={() => {
                      setThreshold(count);
                      setStamps((n) => Math.min(n, count));
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className={styles.progress}>
              <span>
                Collected stamps{" "}
                <output>
                  {stamps} / {threshold}
                </output>
              </span>
              <input
                type="range"
                min="0"
                max={threshold}
                value={stamps}
                onChange={(event) => setStamps(Number(event.target.value))}
              />
            </label>
            <label className={styles.language}>
              Card language
              <select
                value={lang}
                onChange={(event) =>
                  setLang(event.target.value as CustomerLanguage)
                }
              >
                <option value="ka">ქართული</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>
            <label className={styles.earned}>
              <input
                type="checkbox"
                checked={earned}
                onChange={(event) => setEarned(event.target.checked)}
              />
              Preview an earned reward
            </label>
            <button
              type="button"
              className={styles.complete}
              disabled={stamps >= threshold || earned}
              onClick={() => setStamps(threshold)}
            >
              Play final stamp
            </button>
            <p className={styles.note}>
              Sample progress only. Tap the card to check the existing reverse.
            </p>
          </div>
          <div className={styles.stage} lang={lang}>
            <RewardCard
              lang={lang}
              title={customerCopy[lang].cardHeading}
              name={product ? pick(product.name, lang) : rewards[lang]}
              image={product?.photoUrl}
              description={
                product?.description
                  ? pick(product.description, lang)
                  : undefined
              }
              threshold={threshold}
              stamps={stamps}
              earned={earned}
              qr="/api/loyalty/signup-qr"
              scanLabel={customerCopy[lang].scan}
            />
          </div>
        </main>
      </div>
    </CustomerFrame>
  );
}
