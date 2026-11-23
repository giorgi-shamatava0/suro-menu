import "../../../(loyalty)/loyalty.css";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Provider from "@/components/loyalty/Provider";
import Language from "@/app/(loyalty)/loyalty/Language";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import Dashboard from "./Dashboard";
async function Content() {
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  return (
    <div className="loyalty-shell admin-loyalty">
      <header className="customer-header">
        <span className="loyalty-mark" role="img" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <Provider>
        <Dashboard lang={lang} />
      </Provider>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="loyalty-main">
          <p>იტვირთება…</p>
        </main>
      }
    >
      <Content />
    </Suspense>
  );
}
