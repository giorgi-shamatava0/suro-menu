import { Suspense } from "react";
import { connection } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import Loading from "../../LoadingState";
import { cookies } from "next/headers";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import Provider from "@/components/loyalty/Provider";
import LiveCard from "../../LiveCard";
import CustomerFrame from "../../CustomerFrame";
import Language from "../../Language";
async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  await connection();
  const { code } = await params;
  // Resolve request context before constructing Convex's randomly identified client.
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = url
    ? new ConvexHttpClient(url, {
        fetch: (input, options) =>
          fetch(input, {
            ...options,
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          }),
      })
    : null;
  const [initialCard, query] = await Promise.all([
    // A slow server connection must not prevent the live browser subscription.
    client?.query(api.loyalty.publicCard, { code }).catch(() => undefined),
    searchParams,
  ]);
  const lang = customerLanguage(cookieStore.get("lang")?.value);
  return (
    <>
      <header className="customer-header">
        <a href="/loyalty" className="loyalty-mark" aria-label="Suro" />
        <Language lang={lang} />
      </header>
      <Provider>
        <LiveCard
          code={code}
          lang={lang}
          initialCard={initialCard}
          welcome={query.welcome === "1"}
        />
      </Provider>
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  return (
    <CustomerFrame>
      <Suspense fallback={<Loading />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </CustomerFrame>
  );
}
