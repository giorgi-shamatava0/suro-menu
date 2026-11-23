import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api } from "@/convex/_generated/api";
import { backend, currentCard } from "@/lib/loyalty/server";
import { customerCopy, customerLanguage } from "@/lib/loyalty/customer-copy";
import Welcome from "./Welcome";
import Language from "./Language";
import CustomerFrame from "./CustomerFrame";
import Loading from "./LoadingState";
async function Content() {
  await connection();
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  const t = customerCopy[lang];
  let card, program, terms;
  try {
    [card, program, terms] = await Promise.all([
      currentCard(),
      backend().query(api.loyalty.enrollmentPreview, {}),
      backend().query(api.loyalty.publicTerms, {}),
    ]);
  } catch {
    return (
      <main className="loyalty-main">
        <h1>{t.loadError}</h1>
        <a href="/loyalty">{t.retry}</a>
      </main>
    );
  }
  if (card) redirect(`/c/${card.publicCode ?? card.qr}`);
  if (!program)
    return (
      <main className="loyalty-main unavailable-card" lang={lang}>
        <h1>{t.unavailable}</h1>
      </main>
    );
  return (
    <CustomerFrame>
      <header className="customer-header">
        <span className="loyalty-mark" role="img" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <Welcome lang={lang} program={program} terms={terms ?? undefined} />
    </CustomerFrame>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
