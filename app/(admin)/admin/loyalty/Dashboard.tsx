"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import { type CustomerLanguage } from "@/lib/loyalty/customer-copy";
import { adminText } from "@/lib/loyalty/admin-copy";
import { legalText } from "@/lib/loyalty/legal-notice";
import Language from "@/app/(loyalty)/loyalty/Language";
import { AdminCard } from "./CardFace";
import CustomerCards from "./CustomerCards";
import Statistics from "./Statistics";
const tabs = [
  "Cards",
  "Customers",
  "Statistics",
  "Staff",
  "Terms & privacy notice",
];
const dateValue = (at?: number) =>
  at ? new Date(at + 14400000).toISOString().slice(0, 10) : "";
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
    [error, setError] = useState("");
  const lock = useRef(false),
    login = useAction(api.auth.login);
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
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("Fill Georgian")
          ? tr("Fill all three translations before saving.")
          : tr("Unable to save. Please retry."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!ready) return <main className="loyalty-main">{tr("Loading…")}</main>;
  if (!token)
    return (
      <main className="loyalty-main admin-login">
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const password = String(
              new FormData(e.currentTarget).get("password"),
            );
            void run(async () => {
              const t = await login({ password });
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
    <>
      <header className="admin-bar">
        <a
          href="/admin"
          className="admin-back"
          aria-label={tr("Administration")}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="m14 6-6 6 6 6" />
          </svg>
        </a>
        <nav aria-label={tr("Loyalty sections")}>
          {tabs.map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                setTab(t);
                setError("");
              }}
            >
              {tr(t)}
            </button>
          ))}
        </nav>
        <Language lang={lang} />
      </header>
      <main className="loyalty-main loyalty-admin" lang={lang}>
        {error && (
          <p className="loyalty-error" role="alert">
            {error}
          </p>
        )}
        <Settings token={token} lang={lang} tab={tab} busy={busy} run={run} />
      </main>
    </>
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
    data = useQuery(api.loyalty.dashboard, { token }),
    items = useQuery(api.loyalty.rewardItems, { token });
  const save = useMutation(api.loyalty.saveProgram),
    status = useMutation(api.loyalty.setStatus),
    password = useAction(api.loyalty.setSharedStaffPassword),
    loadCredentials = useAction(api.loyalty.currentCredentials),
    saveSignupPin = useAction(api.loyalty.setSignupPin),
    saveTerms = useMutation(api.loyalty.saveTerms);
  const [edit, setEdit] = useState<string | null>(null),
    [product, setProduct] = useState(""),
    [threshold, setThreshold] = useState(8),
    [prefill, setPrefill] = useState(2),
    [end, setEnd] = useState(""),
    [legalLang, setLegalLang] = useState<CustomerLanguage>(lang),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [changed, setChanged] = useState(false),
    [pinChanged, setPinChanged] = useState(false),
    [currentCredentials, setCurrentCredentials] = useState<{
      staffPassword: string | null;
      pin: string | null;
    } | null>(null);
  useEffect(() => {
    if (tab !== "Staff") {
      setCurrentCredentials(null);
      return;
    }
    let active = true;
    void loadCredentials({ token })
      .then((value) => {
        if (active) setCurrentCredentials(value);
      })
      .catch(() => {
        if (active) setCurrentCredentials({ staffPassword: null, pin: null });
      });
    return () => {
      active = false;
    };
  }, [tab, token, changed, pinChanged, loadCredentials]);
  if (!data || !items) return <p>{tr("Loading…")}</p>;
  const item = items.find((i) => i.id === product),
    name = item?.name[lang] || item?.name.ka || "";
  function open(id: string) {
    const p = data!.programs.find((p) => p._id === id),
      r = data!.versions.find(
        (v) => v.programId === id && v.version === p?.version,
      );
    setProduct(p?.rewardItemId ?? "");
    setThreshold(
      [4, 6, 8, 10].includes(r?.threshold ?? 8) ? (r?.threshold ?? 8) : 8,
    );
    setPrefill(p?.welcomeStamps ?? 2);
    setEnd(dateValue(p?.endsAt));
    setEdit(id);
  }
  if (tab === "Staff")
    return (
      <section className="simple-settings">
        <p>
          {tr("Change the password for staff.")}{" "}
          <span className="muted">
            {tr("Username")}: <strong>staff</strong>
          </span>
        </p>
        <p className="current-credential">
          <span>{tr("Current password")}</span>
          <strong>
            {currentCredentials
              ? (currentCredentials.staffPassword ??
                tr("Save again to display"))
              : tr("Loading…")}
          </strong>
        </p>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            void run(async () => {
              await password({
                token,
                password: String(new FormData(f).get("password")),
              });
              f.reset();
              setChanged(true);
            });
          }}
        >
          <label>
            {tr("New password")}
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={200}
              required
              autoComplete="new-password"
              onChange={() => setChanged(false)}
            />
          </label>
          <button className="loyalty-primary" disabled={busy}>
            {tr(changed ? "Password changed" : "Change password")}
          </button>
        </form>
        <h2>{tr("Signup protection PIN")}</h2>
        <p>
          {tr(
            "50 new cards are allowed each hour. After that, staff must enter this PIN for each new card. The allowance resets at the start of the next hour.",
          )}
        </p>
        <p className="muted">
          {tr(
            data.signupProtection.pinConfigured
              ? "PIN is configured"
              : "Set a PIN before the hourly allowance is reached",
          )}
        </p>
        <p className="current-credential">
          <span>{tr("Current PIN")}</span>
          <strong>
            {currentCredentials
              ? (currentCredentials.pin ?? tr("Save again to display"))
              : tr("Loading…")}
          </strong>
        </p>
        <form
          className="loyalty-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => {
              await saveSignupPin({
                token,
                pin: String(new FormData(form).get("pin")),
              });
              form.reset();
              setPinChanged(true);
            });
          }}
        >
          <label>
            {tr("New six-digit PIN")}
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoComplete="new-password"
              onChange={() => setPinChanged(false)}
            />
          </label>
          <button className="loyalty-primary" disabled={busy}>
            {tr(pinChanged ? "PIN saved" : "Save PIN")}
          </button>
        </form>
      </section>
    );
  if (tab === "Customers") return <CustomerCards token={token} lang={lang} />;
  if (tab === "Statistics")
    return <Statistics token={token} lang={lang} programs={data.programs} />;
  if (tab === "Terms & privacy notice") {
    const terms = {
        ka: draft.ka ?? legalText("ka", data.brand?.terms?.ka),
        en: draft.en ?? legalText("en", data.brand?.terms?.en),
        ru: draft.ru ?? legalText("ru", data.brand?.terms?.ru),
      },
      complete = Object.values(terms).every((t) => t.trim());
    return (
      <section className="simple-terms">
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (complete) void run(() => saveTerms({ token, terms }));
          }}
        >
          <select
            aria-label={tr("Language")}
            value={legalLang}
            onChange={(e) => setLegalLang(e.target.value as CustomerLanguage)}
          >
            <option value="ka">ქართული</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
          <label>
            {tr("Terms & privacy notice")}
            <textarea
              key={legalLang}
              value={terms[legalLang]}
              onChange={(e) =>
                setDraft({ ...draft, [legalLang]: e.target.value })
              }
              rows={16}
              required
              maxLength={12000}
            />
          </label>
          <p className="muted translation-check">
            {(["ka", "en", "ru"] as const).map((l) => (
              <span key={l} data-complete={!!terms[l].trim()}>
                {{ ka: "ქართული", en: "English", ru: "Русский" }[l]}{" "}
                {terms[l].trim() ? "✓" : "—"}
              </span>
            ))}
          </p>
          <button className="loyalty-primary" disabled={busy || !complete}>
            {tr("Save")}
          </button>
          {!complete && (
            <small className="muted">
              {tr("Fill all three translations before saving.")}
            </small>
          )}
        </form>
      </section>
    );
  }
  function deleteProgram(id: Id<"loyaltyPrograms">) {
    if (
      !confirm(tr("Delete this card?")) ||
      !confirm(
        tr("Confirm deletion? New customers will no longer receive this card."),
      )
    )
      return;
    void run(async () => {
      await status({ token, id, status: "archived" });
      setEdit(null);
    });
  }
  const p = data.programs.find((p) => p._id === edit),
    visible = data.programs.filter((p) => p.status !== "archived");
  if (edit)
    return (
      <form
        className="card-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (!item) return;
          void run(async () => {
            await save({
              token,
              id: p?._id,
              name: item.name.ka || item.name.en || item.name.ru || "",
              description: "",
              products: item.name.ka || item.name.en || "",
              reward: "",
              rewardItemId: item.id,
              threshold,
              welcomeStamps: prefill,
              expiry: "campaign",
              months: 6,
              endsAt: new Date(end + "T23:59:59+04:00").getTime(),
            });
            setEdit(null);
          });
        }}
      >
        <div className="editor-fields">
          <label>
            {tr("Prefilled stamps")}
            <select
              value={prefill}
              onChange={(e) => setPrefill(Number(e.target.value))}
            >
              {Array.from({ length: threshold - 1 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Menu product")}
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              required
            >
              <option value="">{tr("Choose a menu item")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name[lang] || i.name.ka || i.name.en || i.name.ru}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{tr("Stamps per reward")}</legend>
            <div className="stamp-options">
              {[4, 6, 8, 10].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={threshold === n}
                  onClick={() => {
                    setThreshold(n);
                    setPrefill(Math.min(prefill, n - 1));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            {tr("End date")}
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              min={new Date(Date.now() + 14400000).toISOString().slice(0, 10)}
              required
            />
          </label>
          <div className="form-actions">
            <button
              className="loyalty-primary"
              disabled={busy || !product || !end}
            >
              {tr("Save")}
            </button>
            <button type="button" onClick={() => setEdit(null)}>
              {tr("Cancel")}
            </button>
            {p && (
              <button
                className="delete-program"
                type="button"
                disabled={busy}
                onClick={() => deleteProgram(p._id)}
              >
                {tr("Delete")}
              </button>
            )}
          </div>
        </div>
        <aside>
          <AdminCard
            lang={lang}
            threshold={threshold}
            stamps={prefill}
            reward={name || tr("Choose a menu item")}
          />
          {end && (
            <p className="preview-date">{end.split("-").reverse().join("/")}</p>
          )}
        </aside>
      </form>
    );
  return (
    <section>
      <div className="cards-actions">
        <button className="loyalty-primary" onClick={() => open("new")}>
          {tr("Create a card")}
        </button>
      </div>
      <div className="admin-card-gallery">
        {visible.map((p) => {
          const rules = data.versions.find(
            (v) => v.programId === p._id && v.version === p.version,
          );
          return (
            <article
              className="admin-program"
              data-program-id={p._id}
              data-active={p.status === "active"}
              key={p._id}
            >
              <div className="program-caption">
                <span>{p.rewardNames?.[lang] || p.name}</span>
                <span
                  className="program-state"
                  data-active={p.status === "active"}
                >
                  {tr(p.status)}
                </span>
              </div>
              <AdminCard
                lang={lang}
                threshold={rules?.threshold ?? 8}
                stamps={p.welcomeStamps ?? 2}
                reward={p.rewardNames?.[lang] || p.reward}
              />
              <div className="program-controls">
                <span className="muted">
                  {p.endsAt
                    ? dateValue(p.endsAt).split("-").reverse().join("/")
                    : ""}
                </span>
                <div>
                  <button onClick={() => open(p._id)}>{tr("Edit")}</button>
                  <button
                    className="delete-program"
                    disabled={busy}
                    onClick={() => deleteProgram(p._id)}
                  >
                    {tr("Delete")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        p.status !== "active" &&
                        (!confirm(tr("Activate this card?")) ||
                          !confirm(
                            tr(
                              "This replaces the current active card. Confirm activation?",
                            ),
                          ))
                      )
                        return;
                      void run(() =>
                        status({
                          token,
                          id: p._id,
                          status: p.status === "active" ? "paused" : "active",
                        }),
                      );
                    }}
                  >
                    {tr(p.status === "active" ? "Pause" : "Activate")}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="empty-admin">{tr("No loyalty card available.")}</p>
      )}
    </section>
  );
}
