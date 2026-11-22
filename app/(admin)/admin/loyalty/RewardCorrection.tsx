"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { adminText } from "@/lib/loyalty/admin-copy";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
import { api } from "@/convex/_generated/api";
export default function RewardCorrection({
  lang,
  token,
  busy,
  run,
}: {
  lang: CustomerLanguage;
  token: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const tr = (text: string) => adminText(lang, text);
  const lookup = useMutation(api.loyalty.lookup);
  const cancel = useMutation(api.loyalty.cancelReward);
  const [card, setCard] = useState<FunctionReturnType<
    typeof api.loyalty.lookup
  > | null>(null);
  return (
    <>
      <h2>{tr("Review reward entitlements")}</h2>
      <form
        className="loyalty-form"
        onSubmit={(e) => {
          e.preventDefault();
          const qr = String(new FormData(e.currentTarget).get("qr"));
          setCard(null);
          void run(async () => setCard(await lookup({ token, qr })));
        }}
      >
        <label>
          {tr("Membership identifier")}
          <input
            name="qr"
            required
            pattern="[a-f0-9]{64}"
            maxLength={64}
            onChange={() => setCard(null)}
          />
        </label>
        <button disabled={busy}>{tr("Find rewards")}</button>
      </form>
      {card &&
        card.rewards
          .filter((r) => r.status === "available")
          .map((r) => (
            <form
              className="loyalty-form loyalty-row"
              key={r._id}
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(
                  new FormData(e.currentTarget).get("reason"),
                );
                void run(async () => {
                  await cancel({ token, qr: card.qr, rewardId: r._id, reason });
                  setCard(await lookup({ token, qr: card.qr }));
                });
              }}
            >
              <strong>{r.label}</strong>
              <label>
                {tr("Cancellation reason")}
                <input name="reason" required maxLength={200} />
              </label>
              <label className="loyalty-check">
                <input type="checkbox" required />
                {tr("I confirmed this entitlement should be cancelled.")}
              </label>
              <button disabled={busy}>{tr("Cancel reward")}</button>
            </form>
          ))}
      {card && !card.rewards.some((r) => r.status === "available") && (
        <p>{tr("No available rewards for this member.")}</p>
      )}
    </>
  );
}
