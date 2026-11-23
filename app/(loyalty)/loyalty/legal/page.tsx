import {connection} from "next/server";
import LegalContent from "../LegalContent";
import { backend } from "@/lib/loyalty/server";
import { api } from "@/convex/_generated/api";
import { Suspense } from "react";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import { activationCopy } from "@/lib/loyalty/activation-copy";
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  const lang = customerLanguage((await searchParams).lang),
    a = activationCopy[lang];
  const custom = await backend()
    .query(api.loyalty.publicTerms, {})
    .catch(() => null);
  return (
    <main className="loyalty-main">
      <LegalContent lang={lang} terms={custom?.[lang]} />
      <a href="/loyalty">Suro</a>
    </main>
  );
}
export default function Page(props: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return (
    <Suspense>
      <Content {...props} />
    </Suspense>
  );
}
