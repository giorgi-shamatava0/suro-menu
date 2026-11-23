import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Provider from "@/components/loyalty/Provider";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import Staff from "./Staff";
async function Content() {
  await connection();
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  return (
    <Provider>
      <Staff lang={lang} />
    </Provider>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<main className="staff-main">იტვირთება…</main>}>
      <Content />
    </Suspense>
  );
}
