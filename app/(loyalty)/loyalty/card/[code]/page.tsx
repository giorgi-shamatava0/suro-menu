import { Suspense } from "react";
import Loading from "../../LoadingState";
import { cookies } from "next/headers";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import Provider from "@/components/loyalty/Provider";
import LiveCard from "../../LiveCard";
import CustomerFrame from "../../CustomerFrame";
import Language from "../../Language";
async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lang = customerLanguage((await cookies()).get("lang")?.value);
  return (
    <>
      <header className="customer-header">
        <a href="/loyalty" className="loyalty-mark" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <Provider>
        <LiveCard code={code} lang={lang} />
      </Provider>
    </>
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <CustomerFrame>
      <Suspense fallback={<Loading />}>
        <Content params={params} />
      </Suspense>
    </CustomerFrame>
  );
}
