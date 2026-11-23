import { Suspense } from "react";
import Provider from "@/components/loyalty/Provider";
import Staff from "./Staff";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="loyalty-main">
          <p>Loading staff access…</p>
        </main>
      }
    >
      <Provider>
        <Staff />
      </Provider>
    </Suspense>
  );
}
