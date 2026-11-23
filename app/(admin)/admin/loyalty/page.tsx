import "../../../(loyalty)/loyalty.css";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Provider from "@/components/loyalty/Provider";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import Dashboard from "./Dashboard";
import "./admin-loyalty.css";
async function Content() {
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  return (
    <div className="loyalty-shell admin-loyalty">
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
