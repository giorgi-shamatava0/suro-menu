"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
type Metric = "cards" | "stamps" | "gifts";
const copy = {
  ka: {
    all: "ყველა ბარათი",
    cards: "ბარათები",
    stamps: "ქულები",
    gifts: "საჩუქრები",
    paid: "საწყისი ქულების გარეშე",
    week: "7 დღე",
    month: "30 დღე",
    quarter: "90 დღე",
    year: "ეს წელი",
    custom: "თარიღით",
    from: "დასაწყისი",
    to: "დასასრული",
    loading: "იტვირთება…",
    invalid: "შეამოწმე თარიღები.",
    empty: "ჯერ არ გაცემულა.",
  },
  en: {
    all: "All cards",
    cards: "Cards",
    stamps: "Points",
    gifts: "Gifts",
    paid: "Excludes welcome points",
    week: "7 days",
    month: "30 days",
    quarter: "90 days",
    year: "This year",
    custom: "Dates",
    from: "From",
    to: "To",
    loading: "Loading…",
    invalid: "Check the dates.",
    empty: "No gifts yet.",
  },
  ru: {
    all: "Все карты",
    cards: "Карты",
    stamps: "Баллы",
    gifts: "Подарки",
    paid: "Без начальных баллов",
    week: "7 дней",
    month: "30 дней",
    quarter: "90 дней",
    year: "Этот год",
    custom: "Даты",
    from: "С",
    to: "По",
    loading: "Загрузка…",
    invalid: "Проверьте даты.",
    empty: "Подарков пока нет.",
  },
};
export default function Statistics({
  token,
  lang,
  programs,
}: {
  token: string;
  lang: CustomerLanguage;
  programs: {
    _id: Id<"loyaltyPrograms">;
    name: string;
    status: string;
    rewardNames?: { ka?: string; en?: string; ru?: string };
  }[];
}) {
  const t = copy[lang],
    today = new Date(Date.now() + 14400000).toISOString().slice(0, 10),
    locale = { ka: "ka-GE", en: "en-GB", ru: "ru-RU" }[lang];
  const [period, setPeriod] = useState("30"),
    [program, setProgram] = useState(""),
    [customFrom, setCustomFrom] = useState(today),
    [customTo, setCustomTo] = useState(today),
    [metric, setMetric] = useState<Metric>("cards"),
    [hover, setHover] = useState<number | null>(null),
    [width, setWidth] = useState(800);
  const chart = useRef<HTMLDivElement>(null);
  const to = period === "custom" ? customTo : today;
  const from =
    period === "custom"
      ? customFrom
      : period === "year"
        ? today.slice(0, 4) + "-01-01"
        : new Date(
            new Date(today + "T12:00:00+04:00").getTime() -
              (Number(period) - 1) * 86400000,
          )
            .toISOString()
            .slice(0, 10);
  const start = new Date(from + "T00:00:00+04:00").getTime(),
    end = new Date(to + "T23:59:59+04:00").getTime(),
    valid =
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= end &&
      end - start <= 366 * 86400000;
  const data = useQuery(
    api.loyalty.statistics,
    valid
      ? {
          token,
          from: start,
          to: end,
          programId: program ? (program as Id<"loyaltyPrograms">) : undefined,
        }
      : "skip",
  );
  useEffect(() => {
    const node = chart.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(280, Math.round(entries[0].contentRect.width))),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [!!data]);
  const days = data?.days ?? [],
    max = Math.max(1, ...days.map((d) => d[metric])),
    top = max <= 2 ? max : Math.ceil(max / 2) * 2,
    left = 30,
    right = width - 12,
    plot = right - left,
    step = plot / Math.max(1, days.length),
    bar = Math.max(1, Math.min(16, step * 0.6)),
    x = (i: number) => left + (i + 0.5) * step,
    y = (n: number) => 170 - (n / top) * 145;
  const date = (d: string) => lang === "ka"
    ? `${Number(d.slice(8, 10))} ${["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"][Number(d.slice(5, 7)) - 1]}`
    : new Date(d + "T12:00:00+04:00").toLocaleDateString(locale, { day: "numeric", month: "short" });
  const selected = days[hover ?? days.length - 1];
  return (
    <section className="stats-simple">
      <div className="stats-simple-filters">
        <select
          aria-label={t.all}
          value={program}
          onChange={(e) => {
            setProgram(e.target.value);
            setHover(null);
          }}
        >
          <option value="">{t.all}</option>
          {programs
            .filter(
              (p) =>
                p.status !== "archived" ||
                p._id === program ||
                data?.programs.some(
                  (r) => r.id === p._id && (r.cards || r.stamps || r.gifts),
                ),
            )
            .map((p) => (
              <option key={p._id} value={p._id}>
                {p.rewardNames?.[lang] || p.name}
              </option>
            ))}
        </select>
        <select
          aria-label={t.custom}
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setHover(null);
          }}
        >
          {[
            ["7", t.week],
            ["30", t.month],
            ["90", t.quarter],
            ["year", t.year],
            ["custom", t.custom],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <div className="stats-custom-dates">
            <input
              aria-label={t.from}
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span aria-hidden="true">—</span>
            <input
              aria-label={t.to}
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>
      {!valid ? (
        <p role="alert">{t.invalid}</p>
      ) : !data ? (
        <p>{t.loading}</p>
      ) : (
        <>
          <div className="stats-simple-totals">
            {(["cards", "stamps", "gifts"] as const).map((m) => (
              <button
                key={m}
                aria-pressed={metric === m}
                onClick={() => {
                  setMetric(m);
                  setHover(null);
                }}
                title={m === "stamps" ? t.paid : undefined}
              >
                <span>{t[m]}</span>
                <strong>{data[m].toLocaleString(locale)}</strong>
              </button>
            ))}
          </div>
          <div className="stats-simple-chart" ref={chart}>
            <div className="stats-day" aria-live="polite">
              <span>{selected ? date(selected.date) : ""}</span>
              <strong>{selected?.[metric] ?? 0}</strong>
            </div>
            <svg
              viewBox={`0 0 ${width} 210`}
              role="img"
              aria-label={`${t[metric]}: ${from} — ${to}`}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(
                  Math.max(
                    0,
                    Math.min(
                      days.length - 1,
                      Math.floor(
                        (((e.clientX - r.left) / r.width) * width - left) /
                          step,
                      ),
                    ),
                  ),
                );
              }}
              onPointerLeave={() => setHover(null)}
            >
              {[0, top / 2, top]
                .filter((n, i, a) => Number.isInteger(n) && a.indexOf(n) === i)
                .map((n) => (
                  <g key={n}>
                    <line
                      x1={left}
                      x2={right}
                      y1={y(n)}
                      y2={y(n)}
                      stroke="#e5e9e4"
                    />
                    <text x={left - 10} y={y(n) + 4} textAnchor="end">
                      {n}
                    </text>
                  </g>
                ))}
              {days.map((d, i) => (
                <rect
                  key={d.date}
                  x={x(i) - bar / 2}
                  y={y(d[metric])}
                  width={bar}
                  height={170 - y(d[metric])}
                  rx={Math.min(3, bar / 2)}
                  fill={hover === i ? "#204e3b" : "#639c82"}
                >
                  <title>
                    {date(d.date)} · {d[metric]}
                  </title>
                </rect>
              ))}
              {[0, Math.floor((days.length - 1) / 2), days.length - 1]
                .filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
                .map((i) => (
                  <text
                    key={i}
                    x={i === 0 ? left : i === days.length - 1 ? right : x(i)}
                    y="198"
                    textAnchor={
                      i === 0
                        ? "start"
                        : i === days.length - 1
                          ? "end"
                          : "middle"
                    }
                  >
                    {date(days[i].date)}
                  </text>
                ))}
            </svg>
          </div>
          <div className="stats-gifts">
            <h2>{t.gifts}</h2>
            {data.breakdown.length ? (
              <ul>
                {data.breakdown.map((r, i) => (
                  <li key={`${r.programId}:${i}`}>
                    <div>
                      <span>{r.item}</span>
                      {r.name !== r.item && <small>{r.name}</small>}
                    </div>
                    <strong>{r.count.toLocaleString(locale)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.empty}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
