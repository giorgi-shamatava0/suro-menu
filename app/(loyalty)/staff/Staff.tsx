"use client";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import Scanner from "@/components/loyalty/Scanner";

export default function Staff() {
  const login = useAction(api.loyalty.login);
  const lookup = useMutation(api.loyalty.lookup);
  const issue = useMutation(api.loyalty.issue);
  const logout = useMutation(api.loyalty.logout);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [camera, setCamera] = useState(false);
  const [card, setCard] = useState<FunctionReturnType<
    typeof api.loyalty.lookup
  > | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const keyFor = (signature: string) => {
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    return pending.current.key;
  };
  useEffect(() => {
    setToken(sessionStorage.getItem("suro-staff") ?? "");
    setReady(true);
  }, []);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Request failed. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  const scan = useCallback(
    (value: string) => {
      const identifier = value
        .trim()
        .match(
          /(?:^|\/(?:loyalty\/card|c)\/)([a-f0-9]{64}|[A-Za-z0-9_-]{22})$/,
        )?.[1];
      if (!identifier) {
        setError("Card not recognized");
        return;
      }
      setCamera(false);
      setQr(identifier);
      setCard(null);
      void run(async () => {
        setCard(await lookup({ token, qr: identifier }));
      });
    },
    [lookup, token, run],
  );
  if (!ready)
    return (
      <main className="loyalty-main">
        <p>Loading staff access…</p>
      </main>
    );
  if (!token)
    return (
      <main className="loyalty-main">
        <h1>Behind the counter.</h1>
        <p className="loyalty-muted">Sign in with your staff password.</p>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const t = await login({
                password: String(f.get("password")),
              });
              sessionStorage.setItem("suro-staff", t);
              setToken(t);
            });
          }}
        >
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <button className="loyalty-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && (
          <p className="loyalty-error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <main className="loyalty-main">
      <h1>A stamp for their visit.</h1>
      <div className="loyalty-actions">
        <button
          disabled={busy}
          className="loyalty-primary"
          onClick={() => {
            setCamera(!camera);
            setCard(null);
          }}
        >
          {camera ? "Close camera" : "Scan a card"}
        </button>
        <button
          onClick={() => {
            if (!window.confirm("Log out? You will need your staff password to return.")) return;
            const previous = token;
            setToken("");
            setCard(null);
            setCamera(false);
            sessionStorage.removeItem("suro-staff");
            void logout({ token: previous });
          }}
        >
          Sign out
        </button>
      </div>
      {camera && <Scanner onScan={scan} />}
      <details>
        <summary>Enter a card identifier</summary>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            scan(qr);
          }}
        >
          <label>
            Membership identifier
            <input
              value={qr}
              onChange={(e) => {
                setQr(e.target.value);
                setCard(null);
              }}
              pattern="[a-f0-9]{64}"
              maxLength={64}
              required
            />
          </label>
          <button disabled={busy}>Find card</button>
        </form>
      </details>
      {error && (
        <p className="loyalty-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="loyalty-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Updating…</p>}
      {card && (
        <>
          <h2>Card {card.qr.slice(0, 8)}</h2>
          {card.programs.map((p) => (
            <section className="loyalty-row" key={p._id}>
              <strong>
                {p.name} · {p.stamps}/{p.threshold}
              </strong>
              <p className="loyalty-muted">
                Eligible: {p.products}. Reward: {p.reward}.
              </p>
              {p.status === "active" && (
                <form
                  className="loyalty-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    const count = Number(f.get("count"));
                    const reference = String(f.get("reference"));
                    const key = keyFor(
                      `issue:${qr}:${p._id}:${count}:${reference}`,
                    );
                    void run(async () => {
                      await issue({
                        token,
                        qr,
                        programId: p._id,
                        count,
                        reference,
                        key,
                      });
                      pending.current = null;
                      setCard(await lookup({ token, qr }));
                      setNotice("Stamps added. The live card is updated.");
                      form.reset();
                    });
                  }}
                >
                  <label>
                    Stamps
                    <input
                      name="count"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label>
                    Receipt / purchase reference
                    <input
                      name="reference"
                      placeholder="Unique receipt number"
                      required
                      maxLength={200}
                    />
                  </label>
                  <button disabled={busy}>Confirm purchase & add stamps</button>
                </form>
              )}
            </section>
          ))}
          <h2>Recent activity</h2>
          <div className="loyalty-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Stamps</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {card.history.map((t) => (
                  <tr key={t._id}>
                    <td>
                      {new Date(t.at).toLocaleString("en-GB", {
                        timeZone: "Asia/Tbilisi",
                      })}
                    </td>
                    <td>{t.kind}</td>
                    <td>{t.count}</td>
                    <td>{t.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
