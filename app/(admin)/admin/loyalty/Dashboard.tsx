"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import { useAction, useMutation, useQuery } from "convex/react";
import { adminText } from "@/lib/loyalty/admin-copy";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
import { useEffect, useRef, useState } from "react";
import Analytics from "./Analytics";
import RewardCorrection from "./RewardCorrection";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const field = (f: FormData, name: string) => String(f.get(name) ?? "");
// Calendar dates entered here are explicitly Tbilisi local time, regardless of the admin's device zone.
const timestamp = (f: FormData, name: string) =>
  field(f, name) ? new Date(`${field(f, name)}:00+04:00`).getTime() : undefined;
export default function Dashboard({
  lang: initialLang,
}: {
  lang: CustomerLanguage;
}) {
  const lang = useCustomerLanguage(initialLang);
  const tr = (text: string) => adminText(lang, text);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("Programs");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const login = useAction(api.auth.login);
  const save = useMutation(api.loyalty.saveProgram);
  const status = useMutation(api.loyalty.setStatus);
  const addStaff = useAction(api.loyalty.addStaff);
  const revoke = useMutation(api.loyalty.revokeStaff);
  const saveBrand = useMutation(api.loyalty.brand);
  const saveOffer = useMutation(api.loyalty.saveOffer);
  const toggleOffer = useMutation(api.loyalty.toggleOffer);
  const reverse = useMutation(api.loyalty.reverse);
  useEffect(() => {
    setToken(
      sessionStorage.getItem("suro-loyalty-admin") ??
        localStorage.getItem("suro-admin") ??
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
      if (token) setNotice(tr("Saved."));
    } catch {
      setError(
        tr(
          token
            ? "Unable to save. Please retry."
            : "Unable to sign in. Please check your password and try again.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <main className="loyalty-main" lang={lang}>
        <p>{tr("Loading…")}</p>
      </main>
    );
  if (!token)
    return (
      <main className="loyalty-main admin-login" lang={lang}>
        <h1>{tr("Administration")}</h1>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const t = await login({ password: field(f, "password") });
              sessionStorage.setItem("suro-loyalty-admin", t);
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
            {tr(busy ? "Signing in…" : "Sign in")}
          </button>
        </form>
        {error && (
          <p role="alert" className="loyalty-error">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <main className="loyalty-main" lang={lang}>
      <h1>{tr("Loyalty, at Suro.")}</h1>
      <div
        className="loyalty-tabs"
        role="group"
        aria-label={tr("Loyalty sections")}
      >
        {[
          "Programs",
          "Staff",
          "Offers",
          "Activity",
          "Reports",
          "Cards",
          "Terms",
        ].map((t) => (
          <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>
            {tr(t)}
          </button>
        ))}
        <button
          onClick={() => {
            localStorage.removeItem("suro-admin");
            sessionStorage.removeItem("suro-loyalty-admin");
            setToken("");
          }}
        >
          {tr("Switch account")}
        </button>
      </div>
      {error && (
        <p role="alert" className="loyalty-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <Data
        lang={lang}
        token={token}
        tab={tab}
        busy={busy}
        run={run}
        save={save}
        status={status}
        addStaff={addStaff}
        revoke={revoke}
        saveBrand={saveBrand}
        saveOffer={saveOffer}
        toggleOffer={toggleOffer}
        reverse={reverse}
      />
    </main>
  );
}
type Props = {
  lang: CustomerLanguage;
  token: string;
  tab: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  save: ReturnType<typeof useMutation<typeof api.loyalty.saveProgram>>;
  status: ReturnType<typeof useMutation<typeof api.loyalty.setStatus>>;
  addStaff: ReturnType<typeof useAction<typeof api.loyalty.addStaff>>;
  revoke: ReturnType<typeof useMutation<typeof api.loyalty.revokeStaff>>;
  saveBrand: ReturnType<typeof useMutation<typeof api.loyalty.brand>>;
  saveOffer: ReturnType<typeof useMutation<typeof api.loyalty.saveOffer>>;
  toggleOffer: ReturnType<typeof useMutation<typeof api.loyalty.toggleOffer>>;
  reverse: ReturnType<typeof useMutation<typeof api.loyalty.reverse>>;
};
function Data({
  lang,
  token,
  tab,
  busy,
  run,
  save,
  status,
  addStaff,
  revoke,
  saveBrand,
  saveOffer,
  toggleOffer,
  reverse,
}: Props) {
  const tr = (text: string) => adminText(lang, text);
  const date = (n: number) =>
    new Date(n).toLocaleString(
      lang === "ka" ? "ka-GE" : lang === "ru" ? "ru-RU" : "en-GB",
      { timeZone: "Asia/Tbilisi" },
    );
  const data = useQuery(api.loyalty.dashboard, { token });
  const revokeCard = useMutation(api.loyalty.revokeCard);
  const resetPassword = useAction(api.loyalty.resetStaffPassword);
  const saveTerms = useMutation(api.loyalty.saveTerms);
  const menuRewards = useQuery(
    api.loyalty.rewardItems,
    tab === "Programs" ? { token } : "skip",
  );
  const [edit, setEdit] = useState<Id<"loyaltyPrograms"> | undefined>();
  if (!data) return <p>{tr("Loading loyalty data…")}</p>;
  const program = data.programs.find((p) => p._id === edit);
  const rules = data.versions.find(
    (v) => v.programId === edit && v.version === program?.version,
  );
  const localDate = (n?: number) =>
    n ? new Date(n + 4 * 3600_000).toISOString().slice(0, 16) : "";
  if (tab === "Programs")
    return (
      <>
        <p>
          {data.members}
          {data.capped ? "+" : ""} {tr("memberships ·")}{" "}
          {data.programs.filter((p) => p.status === "active").length}
          {tr("active programs")}
        </p>
        {data.programs.length === 0 && (
          <p className="loyalty-muted">
            {tr("Create your first program below. It starts as a draft.")}
          </p>
        )}
        {data.programs.map((p) => (
          <div className="loyalty-row" key={p._id}>
            <strong>{p.name}</strong>
            <p>
              {p.description} · {tr(p.status)} {tr("· Rule version")}{" "}
              {p.version}
            </p>
            <div className="loyalty-actions">
              <button onClick={() => setEdit(p._id)}>{tr("Edit rules")}</button>
              <label>
                {tr("Status")}
                <select
                  aria-label={`${p.name} status`}
                  value={p.status}
                  disabled={busy}
                  onChange={(e) => {
                    void run(() =>
                      status({ token, id: p._id, status: e.target.value }),
                    );
                  }}
                >
                  {[
                    "draft",
                    "scheduled",
                    "active",
                    "paused",
                    "ended",
                    "archived",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {tr(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
        <h2>{tr(edit ? "New rule version" : "Create a program")}</h2>
        <p className="loyalty-muted">
          {tr(
            "Existing balances keep their current rules until used up. Already earned rewards are preserved.",
          )}
        </p>
        <form
          key={edit ?? "new"}
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await save({
                token,
                id: edit,
                name: field(f, "name"),
                description: field(f, "description"),
                products: field(f, "products"),
                reward: "",
                rewardItemId: field(f, "rewardItemId") as Id<"items">,
                threshold: Number(f.get("threshold")),
                expiry: field(f, "expiry"),
                months: Number(f.get("months")),
                rewardDays: field(f, "rewardDays")
                  ? Number(f.get("rewardDays"))
                  : undefined,
                startsAt: timestamp(f, "startsAt"),
                endsAt: timestamp(f, "endsAt"),
              });
              setEdit(undefined);
            });
          }}
        >
          <label>
            {tr("Name")}
            <input
              name="name"
              defaultValue={program?.name}
              maxLength={80}
              required
            />
          </label>
          <label>
            {tr("Description")}
            <textarea
              name="description"
              defaultValue={program?.description}
              maxLength={1000}
            />
          </label>
          <label>
            {tr("Eligible products")}
            <input
              name="products"
              defaultValue={program?.products}
              required
              maxLength={1000}
            />
          </label>
          <label>
            {tr("Stamps per reward")}
            <input
              type="number"
              name="threshold"
              min={1}
              max={100}
              defaultValue={rules?.threshold ?? 10}
              required
            />
          </label>
          <label>
            {tr("Reward")}
            <select
              name="rewardItemId"
              required
              defaultValue={rules?.rewardItemId ?? program?.rewardItemId ?? ""}
            >
              <option value="">{tr("Choose a menu item")}</option>
              {menuRewards?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name[lang] ||
                    item.name.ka ||
                    item.name.en ||
                    item.name.ru}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Stamp expiration")}
            <select name="expiry" defaultValue={rules?.expiry ?? "rolling"}>
              <option value="rolling">{tr("Rolling inactivity")}</option>
              <option value="fixed">{tr("Fixed expiration per stamp")}</option>
              <option value="never">{tr("Never expire")}</option>
              <option value="campaign">{tr("Campaign end")}</option>
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
            {tr("Reward valid for (days; empty = no expiration)")}
            <input
              name="rewardDays"
              type="number"
              min={1}
              max={3650}
              defaultValue={rules?.rewardDays}
            />
          </label>
          <label>
            {tr("Start (Tbilisi time)")}
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={localDate(program?.startsAt)}
            />
          </label>
          <label>
            {tr("End (Tbilisi time)")}
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={localDate(program?.endsAt)}
            />
          </label>
          <button className="loyalty-primary" disabled={busy}>
            {tr(edit ? "Save new rule version" : "Create draft program")}
          </button>
          {edit && (
            <button type="button" onClick={() => setEdit(undefined)}>
              {tr("Cancel edit")}
            </button>
          )}
        </form>
      </>
    );
  if (tab === "Staff")
    return (
      <>
        <h2>{tr("Staff access")}</h2>
        <p className="loyalty-muted">
          {tr(
            "Staff sign in with a password only. Labels identify activity in the admin panel. Give each person a different password.",
          )}
        </p>
        {data.staff.map((s) => (
          <div className="loyalty-row" key={s._id}>
            <strong>
              {s.name} · {tr(s.role)}
            </strong>
            <p>{tr(s.active ? "Active" : "Access revoked")}</p>
            {s.active && (
              <button
                disabled={busy}
                onClick={() => {
                  void run(() => revoke({ token, id: s._id }));
                }}
              >
                {tr("Revoke access")}
              </button>
            )}{" "}
            <details className="staff-password-reset">
              <summary>{tr("Reset password")}</summary>
              <form
                className="loyalty-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const f = new FormData(form);
                  void run(async () => {
                    await resetPassword({
                      token,
                      id: s._id,
                      password: field(f, "password"),
                    });
                    form.reset();
                  });
                }}
              >
                <label>
                  {tr("New password")}
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    maxLength={200}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <p className="loyalty-muted">
                  {tr("Resetting signs this staff member out on every device.")}
                </p>
                <button disabled={busy}>{tr("Reset password")}</button>
              </form>
            </details>
          </div>
        ))}
        <h2>{tr("Add staff")}</h2>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            void run(async () => {
              await addStaff({
                token,
                name: field(f, "name"),
                password: field(f, "password"),
                role: field(f, "role"),
              });
              form.reset();
            });
          }}
        >
          <label>
            {tr("Staff label (admin only)")}
            <input name="name" required maxLength={80} autoComplete="off" />
          </label>
          <label>
            {tr("Initial password")}
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={200}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            {tr("Role")}
            <select name="role">
              <option value="barista">{tr("Barista")}</option>
              <option value="admin">{tr("Loyalty administrator")}</option>
            </select>
          </label>
          <button disabled={busy}>{tr("Create staff access")}</button>
        </form>
      </>
    );
  if (tab === "Offers")
    return (
      <>
        <h2>{tr("Promotional offers")}</h2>
        <p className="loyalty-muted">
          {tr(
            "Offers are retained when deactivated. Eligibility is checked by staff; offers do not automatically issue stamps.",
          )}
        </p>
        {data.offers.map((o) => (
          <div className="loyalty-row" key={o._id}>
            <strong>{o.name}</strong>
            <p>{o.description}</p>
            <p>
              {date(o.startsAt)} – {date(o.endsAt)} ·{" "}
              {tr(o.active ? "Active" : "Inactive")}
            </p>
            <button
              disabled={busy}
              onClick={() => {
                void run(() =>
                  toggleOffer({ token, id: o._id, active: !o.active }),
                );
              }}
            >
              {tr(o.active ? "Deactivate" : "Activate")}
            </button>
          </div>
        ))}
        <h2>{tr("New offer")}</h2>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            void run(async () => {
              await saveOffer({
                token,
                name: field(f, "name"),
                description: field(f, "description"),
                eligibility: field(f, "eligibility"),
                startsAt: timestamp(f, "start")!,
                endsAt: timestamp(f, "end")!,
                showOnCard: f.get("showOnCard") === "on",
              });
              form.reset();
            });
          }}
        >
          <label>
            {tr("Name")}
            <input name="name" required maxLength={200} />
          </label>
          <label>
            {tr("Description")}
            <textarea name="description" required maxLength={1000} />
          </label>
          <label>
            {tr("Eligibility")}
            <input name="eligibility" required maxLength={1000} />
          </label>
          <label>
            {tr("Starts (Tbilisi)")}
            <input type="datetime-local" name="start" required />
          </label>
          <label>
            {tr("Ends (Tbilisi)")}
            <input type="datetime-local" name="end" required />
          </label>
          <label className="loyalty-check">
            <input type="checkbox" name="showOnCard" />
            {tr("Show this offer on live cards")}
          </label>
          <button disabled={busy}>{tr("Create offer")}</button>
        </form>
      </>
    );
  if (tab === "Terms")
    return (
      <section>
        <h2>{tr("Card terms")}</h2>
        <p className="loyalty-muted">
          {tr(
            "Guests open these terms next to the expiry date. Use plain text; line breaks are preserved.",
          )}
        </p>
        <form
          className="loyalty-form"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            void run(() =>
              saveTerms({
                token,
                terms: {
                  ka: field(f, "ka"),
                  en: field(f, "en"),
                  ru: field(f, "ru"),
                },
              }),
            );
          }}
        >
          {(["ka", "en", "ru"] as const).map((language) => (
            <label key={language}>
              {language === "ka"
                ? "ქართული"
                : language === "en"
                  ? "English"
                  : "Русский"}
              <textarea
                name={language}
                lang={language}
                rows={10}
                maxLength={12000}
                defaultValue={data.brand?.terms?.[language] ?? ""}
              />
            </label>
          ))}
          <button className="loyalty-primary" disabled={busy}>
            {tr("Save terms")}
          </button>
        </form>
      </section>
    );
  if (tab === "Reports")
    return <Analytics token={token} lang={lang} programs={data.programs} />;
  if (tab === "Activity")
    return (
      <>
        <h2>{tr("Recent transactions")}</h2>
        <p className="loyalty-muted">
          {tr(
            "Latest 100 transactions. Corrections preserve the original ledger. Complex corrections involving rewards require entitlement review.",
          )}
        </p>
        <div className="loyalty-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Time (Tbilisi)")}</th>
                <th>{tr("Staff")}</th>
                <th>{tr("Action")}</th>
                <th>{tr("Stamps")}</th>
                <th>{tr("Reference")}</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((t) => (
                <tr key={t._id}>
                  <td>{date(t.at)}</td>
                  <td>{t.actor}</td>
                  <td>{tr(t.kind)}</td>
                  <td>{t.count}</td>
                  <td>{t.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>{tr("Correct stamp issuance")}</h2>
        <form
          className="loyalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() =>
              reverse({
                token,
                transactionId: field(f, "id") as Id<"loyaltyLedger">,
                reason: field(f, "reason"),
              }),
            );
          }}
        >
          <label>
            {tr("Transaction")}
            <select name="id" required>
              <option value="">{tr("Choose a transaction")}</option>
              {data.history
                .filter((t) => t.kind === "award" && !t.reversedBy)
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {date(t.at)} · +{t.count} · {t.reference}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {tr("Reason")}
            <input name="reason" required maxLength={200} />
          </label>
          <button disabled={busy}>{tr("Reverse stamps")}</button>
        </form>
        <RewardCorrection lang={lang} token={token} busy={busy} run={run} />
        <h2>{tr("Administrative audit")}</h2>
        {data.audit.map((a) => (
          <p key={a._id}>
            {date(a.at)} · {a.actor} · {a.event} · {a.detail}
          </p>
        ))}
      </>
    );
  return (
    <>
      <h2>{tr("Revoke a lost or compromised card")}</h2>
      <p className="loyalty-muted">
        {tr(
          "This permanently blocks purchases and redemptions. It preserves the membership history.",
        )}
      </p>
      <form
        className="loyalty-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          void run(async () => {
            await revokeCard({
              token,
              qr: field(f, "qr"),
              reason: field(f, "reason"),
            });
            form.reset();
          });
        }}
      >
        <label>
          {tr("Membership identifier")}
          <input
            name="qr"
            pattern="([a-f0-9]{64}|[A-Za-z0-9_-]{22})"
            required
            maxLength={64}
          />
        </label>
        <label>
          {tr("Reason")}
          <input name="reason" required maxLength={200} />
        </label>
        <label className="loyalty-check">
          <input type="checkbox" required />
          {tr("I understand this card will stop working.")}
        </label>
        <button disabled={busy}>{tr("Revoke card")}</button>
      </form>
      <h2>{tr("Public signup QR")}</h2>
      <a className="loyalty-button" href="/api/loyalty/signup-qr" download>
        {tr("Download signup QR")}
      </a>
      <p>
        {tr("Print a QR code containing your production URL followed by")}{" "}
        <code>/loyalty</code>
        {tr(
          ". This signup link is separate from every customer’s personal card QR.",
        )}
      </p>
    </>
  );
}
