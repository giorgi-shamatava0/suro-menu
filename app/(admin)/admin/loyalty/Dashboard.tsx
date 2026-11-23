"use client";
import CustomerCards from "./CustomerCards";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
import { adminText } from "@/lib/loyalty/admin-copy";
const value = (f: FormData, key: string) => String(f.get(key) ?? "");
export default function Dashboard({
  lang: initial,
}: {
  lang: CustomerLanguage;
}) {
  const lang = useCustomerLanguage(initial),
    tr = (s: string) => adminText(lang, s);
  const [token, setToken] = useState(""),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("Cards"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  const login = useAction(api.auth.login),
    logout = useMutation(api.auth.logout);
  useEffect(() => {
    setToken(
      localStorage.getItem("suro-admin") ??
        sessionStorage.getItem("suro-loyalty-admin") ??
        "",
    );
    setReady(true);
  }, []);
  async function run(fn: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(tr("Saved."));
    } catch {
      setError(tr("Unable to save. Please retry."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!ready) return <main className="loyalty-main">{tr("Loading…")}</main>;
  if (!token)
    return (
      <main className="loyalty-main admin-login">
        <h1>{tr("Administration")}</h1>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const t = await login({ password: value(f, "password") });
              localStorage.setItem("suro-admin", t);
              setToken(t);
            });
          }}
        >
          <label>
            {tr("Password")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <button className="loyalty-primary" disabled={busy}>
            {tr("Sign in")}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  return (
    <main className="loyalty-main loyalty-admin" lang={lang}>
      <header className="loyalty-admin-heading">
        <div>
          <a href="/admin">← {tr("Administration")}</a>
          <h1>{tr("Loyalty cards")}</h1>
        </div>
        <button
          onClick={() => {
            if (!window.confirm(tr("Log out?"))) return;
            void logout({ token });
            localStorage.removeItem("suro-admin");
            sessionStorage.removeItem("suro-loyalty-admin");
            setToken("");
          }}
        >
          {tr("Log out")}
        </button>
      </header>
      <nav className="loyalty-tabs">
        {["Cards", "Staff", "Terms"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {tr(t)}
          </button>
        ))}
      </nav>
      {error && (
        <p className="loyalty-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <Settings token={token} lang={lang} tab={tab} busy={busy} run={run} />
    </main>
  );
}
function Settings({
  token,
  lang,
  tab,
  busy,
  run,
}: {
  token: string;
  lang: CustomerLanguage;
  tab: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const tr = (s: string) => adminText(lang, s),
    data = useQuery(api.loyalty.dashboard, { token });
  const items = useQuery(
    api.loyalty.rewardItems,
    tab === "Cards" ? { token } : "skip",
  );
  const save = useMutation(api.loyalty.saveProgram),
    status = useMutation(api.loyalty.setStatus),
    reset = useAction(api.loyalty.resetStaffPassword),
    add = useAction(api.loyalty.addStaff),
    saveTerms = useMutation(api.loyalty.saveTerms);
  const [edit, setEdit] = useState<string | null>(null);
  if (!data) return <p>{tr("Loading…")}</p>;
  if (tab === "Staff")
    return (
      <section>
        <h2>{tr("Staff access")}</h2>
        <p className="loyalty-muted">
          {tr("Staff can only add stamps. Admin manages everything.")}
        </p>
        {data.staff.map((s) => (
          <div className="loyalty-row" key={s._id}>
            <strong>{s.name}</strong>
            <form
              className="staff-password-reset"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(() =>
                  reset({ token, id: s._id, password: value(f, "password") }),
                );
              }}
            >
              <label>
                {tr("New password")}
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={200}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button disabled={busy}>{tr("Reset password")}</button>
            </form>
          </div>
        ))}
        <details className="admin-disclosure">
          <summary>{tr("Add staff")}</summary>
          <form
            className="loyalty-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                add({
                  token,
                  name: value(f, "name"),
                  password: value(f, "password"),
                  role: "staff",
                }),
              );
            }}
          >
            <label>
              {tr("Staff label (admin only)")}
              <input name="name" required maxLength={80} />
            </label>
            <label>
              {tr("Initial password")}
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={200}
                required
                autoComplete="new-password"
              />
            </label>
            <button disabled={busy}>{tr("Create staff access")}</button>
          </form>
        </details>
      </section>
    );
  if (tab === "Terms")
    return (
      <section>
        <h2>{tr("Terms")}</h2>
        <a href="/loyalty/legal" target="_blank" rel="noopener">
          {tr("Terms & privacy notice")}
        </a>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() =>
              saveTerms({
                token,
                terms: {
                  ka: value(f, "ka"),
                  en: value(f, "en"),
                  ru: value(f, "ru"),
                },
              }),
            );
          }}
        >
          {(["ka", "en", "ru"] as const).map((l) => (
            <label key={l}>
              {{ ka: "ქართული", en: "English", ru: "Русский" }[l]}
              <textarea
                name={l}
                defaultValue={data.brand?.terms?.[l] ?? ""}
                rows={6}
                maxLength={10000}
              />
            </label>
          ))}
          <button disabled={busy}>{tr("Save terms")}</button>
        </form>
      </section>
    );
  const p = data.programs.find((p) => p._id === edit),
    rules = data.versions.find(
      (v) => v.programId === p?._id && v.version === p?.version,
    );
  return (
    <section>
      <CustomerCards token={token} />
      <div className="loyalty-admin-heading">
        <h2>{tr("Cards")}</h2>
        <button className="loyalty-primary" onClick={() => setEdit("new")}>
          {tr("Create a card")}
        </button>
      </div>
      {data.programs.map((p) => {
        const r = data.versions.find(
          (v) => v.programId === p._id && v.version === p.version,
        );
        return (
          <div className="loyalty-row program-summary" key={p._id}>
            <div>
              <strong>{p.name}</strong>
              <p>
                {r?.threshold ?? 8} · {p.reward}
              </p>
              <span
                className="program-state"
                data-active={p.status === "active"}
              >
                {tr(p.status)}
              </span>
            </div>
            <div className="loyalty-actions">
              <button onClick={() => setEdit(p._id)}>{tr("Edit")}</button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    status({
                      token,
                      id: p._id,
                      status: p.status === "active" ? "paused" : "active",
                    }),
                  )
                }
              >
                {tr(p.status === "active" ? "Pause" : "Activate")}
              </button>
            </div>
          </div>
        );
      })}
      {edit && (
        <form
          key={edit}
          className="loyalty-form program-editor"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await save({
                token,
                id: p?._id,
                name: value(f, "name"),
                description: p?.description ?? "",
                products: value(f, "products"),
                reward: "",
                rewardItemId: value(f, "reward") as Id<"items">,
                threshold: Number(value(f, "threshold")),
                expiry: value(f, "expiry"),
                months: Number(value(f, "months")),
                endsAt: value(f, "endsAt")
                  ? new Date(value(f, "endsAt") + "T23:59:59+04:00").getTime()
                  : undefined,
                rewardDays: value(f, "rewardDays")
                  ? Number(value(f, "rewardDays"))
                  : undefined,
              });
              setEdit(null);
            });
          }}
        >
          <h2>{tr(p ? "Edit card" : "Create a card")}</h2>
          <label>
            {tr("Name")}
            <input name="name" defaultValue={p?.name} required maxLength={80} />
          </label>
          <label>
            {tr("Eligible products")}
            <input
              name="products"
              defaultValue={p?.products ?? "All purchases"}
              required
              maxLength={1000}
            />
          </label>
          <label>
            {tr("Stamps per reward")}
            <input
              type="number"
              name="threshold"
              min={3}
              max={20}
              defaultValue={rules?.threshold ?? 8}
              required
            />
          </label>
          <label>
            {tr("Reward")}
            <select name="reward" defaultValue={p?.rewardItemId ?? ""} required>
              <option value="">{tr("Choose a menu item")}</option>
              {items?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name[lang] || i.name.ka || i.name.en || i.name.ru}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>{tr("Expiration settings")}</summary>
            <label>
              {tr("Stamp expiration")}
              <select name="expiry" defaultValue={rules?.expiry ?? "rolling"}>
                <option value="rolling">{tr("Rolling inactivity")}</option>
                <option value="campaign">{tr("Redeem before date")}</option>
                <option value="never">{tr("Never expire")}</option>
              </select>
            </label>
            <label>
              {tr("Expiration duration (calendar months)")}
              <input
                name="months"
                type="number"
                min={1}
                max={120}
                defaultValue={rules?.months ?? 6}
                required
              />
            </label>
            <label>
              {tr("Redeem before date")}
              <input
                type="date"
                name="endsAt"
                defaultValue={
                  p?.endsAt
                    ? new Date(p.endsAt + 14400000).toISOString().slice(0, 10)
                    : ""
                }
              />
            </label>
            <label>
              {tr("Reward valid for (days; empty = no expiration)")}
              <input
                name="rewardDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={rules?.rewardDays}
              />
            </label>
          </details>
          <div className="loyalty-actions">
            <button className="loyalty-primary" disabled={busy}>
              {tr("Save")}
            </button>
            <button type="button" onClick={() => setEdit(null)}>
              {tr("Cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
