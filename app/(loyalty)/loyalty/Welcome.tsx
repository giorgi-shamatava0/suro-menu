"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import CardPreview from "./CardPreview";
import Join from "./Join";
export default function Welcome({ lang: initial }: { lang: CustomerLanguage }) {
  const lang = useCustomerLanguage(initial);
  const t = customerCopy[lang];
  const program = useQuery(api.loyalty.enrollmentPreview, {});
  if (program === undefined)
    return (
      <main className="loyalty-main customer-main" role="status">
        <span className="loyalty-spinner" />
        {t.loading}
      </main>
    );
  if (!program)
    return (
      <main className="loyalty-main customer-main">
        <h1>{t.unavailable}</h1>
      </main>
    );
  const reward = t.rewardGift.replace(
    "{item}",
    program.rewardNames?.[lang] || program.reward,
  );
  return (
    <main className="loyalty-main customer-main customer-welcome" lang={lang}>
      <h1>{t.greeting}</h1>
      <p className="loyalty-muted">{t.intro}</p>
      <CardPreview lang={lang} threshold={program.threshold} reward={reward} />
      <Join lang={lang} />
    </main>
  );
}
