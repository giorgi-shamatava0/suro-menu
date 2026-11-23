"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
import CardPreview from "./CardPreview";
import Join from "./Join";
export default function Welcome({
  lang: initial,
  program,
  terms,
}: {
  lang: CustomerLanguage;
  program: {
    threshold: number;
    reward: string;
    rewardNames?: { ka?: string; en?: string; ru?: string };
  } | null;
  terms?: { ka: string; en: string; ru: string };
}) {
  const lang = useCustomerLanguage(initial);
  const t = customerCopy[lang];
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
      <h1>
        {
          {
            ka: "მიიღე ლოიალურობის ბარათი.",
            en: "Get your loyalty card.",
            ru: "Получите карту лояльности.",
          }[lang]
        }
      </h1>
      <CardPreview lang={lang} threshold={program.threshold} reward={reward} />
      <Join lang={lang} terms={terms?.[lang]} />
    </main>
  );
}
