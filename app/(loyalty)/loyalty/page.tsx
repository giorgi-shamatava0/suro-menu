import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentCard } from "@/lib/loyalty/server";
import { customerCopy, customerLanguage } from "@/lib/loyalty/customer-copy";
import Provider from "@/components/loyalty/Provider";
import Welcome from "./Welcome";
import Language from "./Language";
import CustomerFrame from "./CustomerFrame";
import Loading from "./LoadingState";
async function Content() {
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  const t = customerCopy[lang];
  let card;
  try {
    card = await currentCard();
  } catch {
    return (
      <main className="loyalty-main">
        <h1>{t.loadError}</h1>
        <a href="/loyalty">{t.retry}</a>
      </main>
    );
  }
  if (card) redirect(`/c/${card.publicCode ?? card.qr}`);
  return (
    <>
      <header className="customer-header">
        <span className="loyalty-mark" role="img" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <Provider>
        <Welcome lang={lang} />
      </Provider>
    </>
  );
}
export default function Page() {
  return (
    <CustomerFrame>
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </CustomerFrame>
  );
}
