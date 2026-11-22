"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";
export default function Provider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() =>
    process.env.NEXT_PUBLIC_CONVEX_URL
      ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
      : null,
  );
  if (!client)
    return (
      <main className="loyalty-main">
        <h1>Loyalty is being set up.</h1>
        <p>Please ask the café team for help.</p>
      </main>
    );
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
