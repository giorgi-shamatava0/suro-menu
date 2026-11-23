"use client";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { adminText } from "@/lib/loyalty/admin-copy";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
import { AdminCard } from "./CardFace";
import { api } from "@/convex/_generated/api";
export default function CustomerCards({
  token,
  lang,
}: {
  token: string;
  lang: CustomerLanguage;
}) {
  const tr = (s: string) => adminText(lang, s);
  const lookup = useMutation(api.loyalty.lookup),
    setPoints = useMutation(api.loyalty.setPoints),
    revoke = useMutation(api.loyalty.revokeCard);
  const [card, setCard] = useState<FunctionReturnType<
      typeof api.loyalty.lookup
    > | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
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
      setError(tr("Unable to update this card. Check the code and try again."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="admin-disclosure" open>
      <summary>{tr("Customer card lookup")}</summary>
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
            setError(tr("Paste a card link or identifier."));
            return;
          }
          setCode(id);
          setEditing(null);
          setCard(null);
          pending.current.clear();
          void run(async () => setCard(await lookup({ token, qr: id })));
        }}
      >
        <label>
          {tr("Card link or identifier")}
          <input name="code" required maxLength={300} />
        </label>
        <button disabled={busy}>{tr("Find card")}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {card && (
        <section>
          {card.programs.map((p) => (
            <div className="customer-card-preview" key={p._id}>
              <AdminCard
                lang={lang}
                threshold={p.threshold}
                stamps={p.stamps}
                reward={p.rewardNames?.[lang] || p.reward}
              />
              <div className="form-actions">
                <button
                  disabled={busy}
                  onClick={() => setEditing(editing === p._id ? null : p._id)}
                >
                  {tr("Edit points")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(tr("Delete this customer card?")) ||
                      !confirm(
                        tr("Confirm deletion? This card will stop working."),
                      )
                    )
                      return;
                    void run(async () => {
                      await revoke({
                        token,
                        qr: code,
                        reason: "Deleted by administrator",
                      });
                      setCard(null);
                      setEditing(null);
                    });
                  }}
                >
                  {tr("Delete")}
                </button>
              </div>
              {editing === p._id && (
                <form
                  className="loyalty-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const points = Number(
                      new FormData(e.currentTarget).get("points"),
                    );
                    const signature = `${code}:${p._id}:${points}`;
                    let key = pending.current.get(signature);
                    if (!key) {
                      key = crypto.randomUUID();
                      pending.current.set(signature, key);
                    }
                    void run(async () => {
                      await setPoints({
                        token,
                        qr: code,
                        programId: p._id,
                        points,
                        key,
                      });
                      setCard(await lookup({ token, qr: code }));
                      setEditing(null);
                      pending.current.delete(signature);
                    });
                  }}
                >
                  <label>
                    {tr("Points")}
                    <input
                      name="points"
                      type="number"
                      min={0}
                      max={p.threshold}
                      defaultValue={p.stamps}
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button className="loyalty-primary" disabled={busy}>
                      {tr("Save")}
                    </button>
                    <button type="button" onClick={() => setEditing(null)}>
                      {tr("Cancel")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </section>
      )}
    </details>
  );
}
