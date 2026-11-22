"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
import CardPreview from "./CardPreview";
import Join from "./Join";
export default function Welcome({ lang: initial }: { lang: CustomerLanguage }) {
  const lang = useCustomerLanguage(initial);
  const t = customerCopy[lang];
  return (
    <main className="loyalty-main customer-main customer-welcome" lang={lang}>
      <h1>{t.greeting}</h1>
      <p className="loyalty-muted">{t.intro}</p>
      <CardPreview lang={lang} />
      <Join lang={lang} />
    </main>
  );
}
