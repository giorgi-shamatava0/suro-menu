import { Suspense } from "react";
import { cookies } from "next/headers";
import { currentCard } from "@/lib/loyalty/server";
import { customerCopy, customerLanguage } from "@/lib/loyalty/customer-copy";
import Welcome from "./Welcome";
import Language from "./Language";
import CustomerFrame from "./CustomerFrame";
import Loading from "./LoadingState";
import LiveCard from "./LiveCard";
import Provider from "@/components/loyalty/Provider";
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
  return (
    <>
      <header className="customer-header">
        <span className="loyalty-mark" role="img" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      {card ? (
        <Provider>
          <LiveCard code={card.qr} lang={lang} />
        </Provider>
      ) : (
        <Welcome lang={lang} />
      )}
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
