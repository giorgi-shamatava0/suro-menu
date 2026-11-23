import { Suspense } from "react";
import Loading from "../LoadingState";
import Provider from "@/components/loyalty/Provider";
import CardDesignPreview from "./CardDesignPreview";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Provider>
        <CardDesignPreview />
      </Provider>
    </Suspense>
  );
}
