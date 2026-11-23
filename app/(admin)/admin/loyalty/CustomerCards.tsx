"use client";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
export default function CustomerCards({ token }: { token: string }) {
  const lookup = useMutation(api.loyalty.lookup),
    redeem = useMutation(api.loyalty.redeem),
    revoke = useMutation(api.loyalty.revokeCard),
    reverse = useMutation(api.loyalty.reverse);
  const [card, setCard] = useState<FunctionReturnType<
      typeof api.loyalty.lookup
    > | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    pending = useRef(new Map<string, string>());
  async function run(fn: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError("Unable to update this card. Check the code and try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="admin-disclosure">
      <summary>Find a customer card</summary>
      <form
        className="loyalty-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(
            new FormData(e.currentTarget).get("code") ?? "",
          ).trim();
          const id = value.match(
            /(?:^|\/(?:c|loyalty\/card)\/)([a-f0-9]{64}|[A-Za-z0-9_-]{22})$/,
          )?.[1];
          if (!id) {
            setError("Paste a card link or identifier.");
            return;
          }
          setCode(id);
          void run(async () => setCard(await lookup({ token, qr: id })));
        }}
      >
        <label>
          Card link or identifier
          <input name="code" required maxLength={300} />
        </label>
        <button disabled={busy}>Find card</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {card && (
        <section>
          {card.programs.map((p) => (
            <p key={p._id}>
              {p.name}:{" "}
              <strong>
                {p.stamps}/{p.threshold}
              </strong>
            </p>
          ))}
          {card.rewards
            .filter((r) => r.status === "available")
            .map((r) => (
              <div className="loyalty-row" key={r._id}>
                <strong>{r.label}</strong>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(
                        "Give this reward to the customer and mark it redeemed?",
                      )
                    )
                      return;
                    void run(async () => {
                      let key = pending.current.get(r._id);
                      if (!key) {
                        key = crypto.randomUUID();
                        pending.current.set(r._id, key);
                      }
                      await redeem({
                        token,
                        qr: code,
                        rewardId: r._id,
                        key,
                        confirmed: true,
                      });
                      setCard(await lookup({ token, qr: code }));
                    });
                  }}
                >
                  Redeem reward
                </button>
              </div>
            ))}
          <details>
            <summary>Correct a stamp</summary>
            {card.history
              .filter((h) => h.kind === "award" && !h.reversedBy)
              .map((h) => (
                <div className="loyalty-row" key={h._id}>
                  <span>
                    {h.reference} · {h.count}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt(
                        "Why should these stamps be removed?",
                      );
                      if (!reason?.trim()) return;
                      void run(async () => {
                        await reverse({ token, transactionId: h._id, reason });
                        setCard(await lookup({ token, qr: code }));
                      });
                    }}
                  >
                    Undo stamps
                  </button>
                </div>
              ))}
          </details>
          <details>
            <summary>Deactivate this card</summary>
            <button
              disabled={busy}
              onClick={() => {
                const reason = prompt("Why should this card be deactivated?");
                if (
                  !reason?.trim() ||
                  !confirm("Deactivate this card? This prevents further use.")
                )
                  return;
                void run(async () => {
                  await revoke({ token, qr: code, reason });
                  setCard(null);
                });
              }}
            >
              Deactivate card
            </button>
          </details>
        </section>
      )}
    </details>
  );
}
