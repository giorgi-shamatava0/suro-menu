"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import Scanner from "@/components/loyalty/Scanner";
import StampGrid from "@/components/loyalty/StampGrid";
import Language from "../loyalty/Language";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
type Card = FunctionReturnType<typeof api.loyalty.lookup>;
type Result = FunctionReturnType<typeof api.loyalty.issue>;
const words = {
  ka: {
    scan: "სკანერი",
    history: "ისტორია",
    rewards: "საჩუქრები",
    password: "პაროლი",
    login: "შესვლა",
    logout: "გასვლა",
    camera: "QR-ის სკანირება",
    close: "კამერის დახურვა",
    manual: "ბმულით გახსნა",
    link: "ბარათის ბმული ან კოდი",
    open: "გახსნა",
    receipt: "ჩეკის ნომერი",
    points: "ქულები",
    confirm: "დამატება",
    next: "შემდეგი ბარათი",
    earned: "საჩუქარი!",
    available: "ეკუთვნის",
    given: "გაცემულია",
    cancelled: "გაუქმებულია",
    expired: "ვადა გასულია",
    empty: "ჯერ ცარიელია.",
    noRewards: "ჯერ არ გაცემულა.",
    loading: "იტვირთება…",
    failed: "ვერ შესრულდა. სცადე ხელახლა.",
    invalid: "ბარათი ვერ მოიძებნა.",
    added: "ქულა დაემატა",
    paused: "შეჩერებულია",
    out: "გსურს გასვლა?",
    cameraError: "კამერა მიუწვდომელია. გახსენი ბარათი ბმულით.",
    username: "მომხმარებელი",
  },
  en: {
    scan: "Scan",
    history: "History",
    rewards: "Rewards",
    password: "Password",
    login: "Sign in",
    logout: "Sign out",
    camera: "Scan QR",
    close: "Close camera",
    manual: "Open by link",
    link: "Card link or code",
    open: "Open",
    receipt: "Receipt number",
    points: "Points",
    confirm: "Add",
    next: "Next card",
    earned: "Reward earned!",
    available: "Available",
    given: "Given",
    cancelled: "Cancelled",
    expired: "Expired",
    empty: "Nothing yet.",
    noRewards: "No rewards yet.",
    loading: "Loading…",
    failed: "Couldn’t complete. Please retry.",
    invalid: "Card not found.",
    added: "Points added",
    paused: "Paused",
    out: "Sign out?",
    cameraError: "Camera unavailable. Open the card by link.",
    username: "Username",
  },
  ru: {
    scan: "Сканер",
    history: "История",
    rewards: "Подарки",
    password: "Пароль",
    login: "Войти",
    logout: "Выйти",
    camera: "Сканировать QR",
    close: "Закрыть камеру",
    manual: "Открыть по ссылке",
    link: "Ссылка или код карты",
    open: "Открыть",
    receipt: "Номер чека",
    points: "Баллы",
    confirm: "Добавить",
    next: "Следующая карта",
    earned: "Подарок заработан!",
    available: "Доступен",
    given: "Выдан",
    cancelled: "Отменён",
    expired: "Истёк",
    empty: "Пока пусто.",
    noRewards: "Подарков пока нет.",
    loading: "Загрузка…",
    failed: "Не удалось. Попробуйте снова.",
    invalid: "Карта не найдена.",
    added: "Баллы добавлены",
    paused: "Приостановлено",
    out: "Выйти?",
    cameraError: "Камера недоступна. Откройте карту по ссылке.",
    username: "Пользователь",
  },
};
const time = (at: number) => {
  const d = new Date(at + 14400000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const short = (code: string) => `#${code.slice(-8)}`;
export default function Staff({ lang: initial }: { lang: CustomerLanguage }) {
  const lang = useCustomerLanguage(initial),
    t = words[lang];
  const login = useAction(api.loyalty.login),
    lookup = useMutation(api.loyalty.lookup),
    issue = useMutation(api.loyalty.issue),
    logout = useMutation(api.loyalty.logout);
  const [token, setToken] = useState(""),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<"scan" | "history" | "rewards">("scan"),
    [camera, setCamera] = useState(false),
    [card, setCard] = useState<Card | null>(null),
    [qr, setQr] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Result | null>(null),
    [count, setCount] = useState(1);
  const session = useQuery(
    api.loyalty.scannerSession,
    token ? { token } : "skip",
  );
  const activity = useQuery(
    api.loyalty.staffActivity,
    token && session && tab !== "scan" ? { token, kind: tab } : "skip",
  );
  const lock = useRef(false),
    pending = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    setToken(sessionStorage.getItem("suro-staff") ?? "");
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (!token || session === undefined) return;
    const clear = () => {
      sessionStorage.removeItem("suro-staff");
      setToken("");
      setCard(null);
      setResult(null);
      setCamera(false);
    };
    if (!session) {
      clear();
      return;
    }
    const timer = setTimeout(
      clear,
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [token, session]);
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch {
        setError(words[lang].failed);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [lang],
  );
  const scan = useCallback(
    (value: string) => {
      const code = value
        .trim()
        .match(
          /(?:^|\/(?:loyalty\/card|c)\/)([a-f0-9]{64}|[A-Za-z0-9_-]{22})$/,
        )?.[1];
      if (!code) {
        setError(words[lang].invalid);
        return;
      }
      setCamera(false);
      setTab("scan");
      setResult(null);
      setCard(null);
      setQr(code);
      setCount(1);
      pending.current = null;
      void run(async () => {
        setCard(await lookup({ token, qr: code }));
      });
    },
    [lang, lookup, token, run],
  );
  const name = (r: {
    label?: string;
    reward?: string;
    names?: { ka?: string; en?: string; ru?: string };
    rewardNames?: { ka?: string; en?: string; ru?: string };
  }) => r.names?.[lang] || r.rewardNames?.[lang] || r.label || r.reward || "";
  function reset() {
    setCard(null);
    setResult(null);
    setQr("");
    setError("");
    setCount(1);
    setCamera(false);
    pending.current = null;
  }
  if (!ready) return <main className="staff-main">{t.loading}</main>;
  if (!token)
    return (
      <main className="staff-login">
        <h1>{t.scan}</h1>
        <p>
          {t.username}: <strong>staff</strong>
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const password = String(
              new FormData(e.currentTarget).get("password"),
            );
            void run(async () => {
              const value = await login({ username: "staff", password });
              sessionStorage.setItem("suro-staff", value);
              setToken(value);
            });
          }}
        >
          <label>
            {t.password}
            <input
              type="password"
              name="password"
              required
              maxLength={200}
              autoComplete="current-password"
            />
          </label>
          <button className="staff-primary" disabled={busy}>
            {busy ? t.loading : t.login}
          </button>
        </form>
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
      </main>
    );
  if (!session) return <main className="staff-main">{t.loading}</main>;
  return (
    <>
      <header className="staff-bar">
        <nav aria-label={t.scan}>
          {(["scan", "history", "rewards"] as const).map((v) => (
            <button
              key={v}
              aria-current={tab === v ? "page" : undefined}
              onClick={() => {
                setTab(v);
                setCamera(false);
                setError("");
              }}
            >
              {t[v]}
            </button>
          ))}
        </nav>
        <Language lang={lang} />
      </header>
      <main className="staff-main" lang={lang}>
        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}
        {tab === "scan" ? (
          <>
            {!card && (
              <div className="staff-scan-start">
                <button
                  className="staff-primary staff-scan-button"
                  disabled={busy}
                  onClick={() => {
                    setCamera(!camera);
                    setError("");
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z" />
                  </svg>
                  {camera ? t.close : t.camera}
                </button>
                {camera && (
                  <Scanner onScan={scan} unavailableMessage={t.cameraError} />
                )}
                <details>
                  <summary>{t.manual}</summary>
                  <form
                    className="staff-link-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      scan(String(new FormData(e.currentTarget).get("code")));
                    }}
                  >
                    <label>
                      {t.link}
                      <input name="code" required maxLength={300} />
                    </label>
                    <button disabled={busy}>{busy ? t.loading : t.open}</button>
                  </form>
                </details>
              </div>
            )}
            {card && (
              <>
                <div className="staff-card-id">
                  <strong>{short(card.publicCode ?? card.qr)}</strong>
                  <button disabled={busy} onClick={reset}>
                    {t.next}
                  </button>
                </div>
                {result && (
                  <section
                    className={`staff-result ${result.rewards.length ? "has-reward" : ""}`}
                    role="status"
                  >
                    <span>{result.rewards.length ? t.earned : t.added}</span>
                    {result.rewards.map((r) => (
                      <strong key={r.id}>{name(r)}</strong>
                    ))}
                  </section>
                )}
                {!result &&
                  card.rewards
                    .filter((r) => r.status === "available")
                    .map((r) => (
                      <section className="staff-result has-reward" key={r._id}>
                        <span>{t.available}</span>
                        <strong>{name(r)}</strong>
                      </section>
                    ))}
                {card.programs.map((p) => (
                  <section className="staff-progress" key={p._id}>
                    <div className="staff-progress-heading">
                      <span>{name(p)}</span>
                      <strong>
                        {p.stamps}/{p.threshold}
                      </strong>
                    </div>
                    <StampGrid threshold={p.threshold} stamps={p.stamps} />
                    {p.status === "active" ? (
                      <form
                        className="staff-stamp-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget,
                            reference = String(
                              new FormData(form).get("receipt"),
                            ).trim(),
                            signature = `${qr}:${p._id}:${count}:${reference}`;
                          if (pending.current?.signature !== signature)
                            pending.current = {
                              signature,
                              key: crypto.randomUUID(),
                            };
                          const key = pending.current.key;
                          void run(async () => {
                            const receipt = await issue({
                              token,
                              qr,
                              programId: p._id,
                              count,
                              reference,
                              key,
                            });
                            setResult(receipt);
                            setCard((current) =>
                              current
                                ? {
                                    ...current,
                                    programs: current.programs.map((v) =>
                                      v._id === p._id
                                        ? {
                                            ...v,
                                            stamps: receipt.stamps,
                                            expiresAt: receipt.expiresAt,
                                          }
                                        : v,
                                    ),
                                  }
                                : current,
                            );
                            pending.current = null;
                            form.reset();
                            setCount(1);
                          });
                        }}
                      >
                        <label>
                          {t.receipt}
                          <input
                            name="receipt"
                            required
                            maxLength={200}
                            autoComplete="off"
                          />
                        </label>
                        <label className="staff-point-count">
                          {t.points}
                          <select
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                          >
                            {Array.from({ length: 20 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="staff-primary" disabled={busy}>
                          {busy ? t.loading : `${t.confirm} · +${count}`}
                        </button>
                      </form>
                    ) : (
                      <p className="staff-muted">{t.paused}</p>
                    )}
                  </section>
                ))}
              </>
            )}
          </>
        ) : activity === undefined ? (
          <p className="staff-muted">{t.loading}</p>
        ) : activity.length === 0 ? (
          <p className="staff-empty">
            {tab === "rewards" ? t.noRewards : t.empty}
          </p>
        ) : (
          <ul className="staff-feed">
            {activity.map((row) => (
              <li key={row.id}>
                <button
                  disabled={!row.code || row.revoked || busy}
                  onClick={() => row.code && scan(row.code)}
                >
                  <div>
                    <strong>
                      {tab === "rewards"
                        ? row.rewards.map(name).join(" · ")
                        : row.code
                          ? short(row.code)
                          : "—"}
                    </strong>
                    {(tab === "rewards" || row.rewards.length === 0) && (
                      <span>
                        {tab === "rewards"
                          ? row.code
                            ? short(row.code)
                            : "—"
                          : row.names?.[lang] || row.program}
                      </span>
                    )}
                    {tab === "history" && row.rewards.length > 0 && (
                      <span className="staff-feed-reward">
                        {row.rewards.map(name).join(" · ")}
                      </span>
                    )}
                  </div>
                  <div className="staff-feed-meta">
                    <time dateTime={new Date(row.at).toISOString()}>
                      {time(row.at)}
                    </time>
                    <span>
                      {tab === "history"
                        ? row.reversed
                          ? t.cancelled
                          : `+${row.points}`
                        : row.revoked
                          ? t.cancelled
                          : row.rewards.every((r) => r.status === "redeemed")
                            ? t.given
                            : row.rewards.some((r) => r.status === "available")
                              ? t.available
                              : row.rewards.some(
                                    (r) => r.status === "cancelled",
                                  )
                                ? t.cancelled
                                : t.expired}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <footer className="staff-footer">
        <button
          onClick={() => {
            if (!confirm(t.out)) return;
            const old = token;
            setToken("");
            reset();
            sessionStorage.removeItem("suro-staff");
            void logout({ token: old });
          }}
        >
          {t.logout}
        </button>
      </footer>
    </>
  );
}
