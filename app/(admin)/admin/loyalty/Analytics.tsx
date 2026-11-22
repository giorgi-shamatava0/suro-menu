"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
const copy = {
  en: {
    title: "Loyalty analytics",
    year: "Year",
    program: "Program",
    all: "All cards",
    card: "Customer card link or identifier (optional)",
    apply: "View card",
    clear: "All customers",
    activated: "Cards activated",
    stamps: "Stamps issued",
    earned: "Rewards earned",
    redeemed: "Rewards redeemed",
    loading: "Loading analytics…",
    note: "Monthly totals in Tbilisi time. Activation means enrollment; for a program, it means the card’s first participation. Stamps issued include subsequently reversed stamps. Earned and redeemed rewards are counted separately.",
    empty: "No activity in this period.",
    invalid: "Enter a valid card link or 64-character card identifier.",
  },
  ka: {
    title: "ლოიალობის ანალიტიკა",
    year: "წელი",
    program: "პროგრამა",
    all: "ყველა ბარათი",
    card: "მომხმარებლის ბმული ან ბარათის კოდი (არასავალდებულო)",
    apply: "ბარათის ნახვა",
    clear: "ყველა მომხმარებელი",
    activated: "გააქტიურებული ბარათები",
    stamps: "გაცემული შტამპები",
    earned: "გამომუშავებული საჩუქრები",
    redeemed: "მიღებული საჩუქრები",
    loading: "ანალიტიკა იტვირთება…",
    note: "თვიური მონაცემები თბილისის დროით. აქტივაცია ნიშნავს რეგისტრაციას, პროგრამისთვის — პირველ მონაწილეობას. გაცემული შტამპები მოიცავს მოგვიანებით გაუქმებულსაც. გამომუშავებული და მიღებული საჩუქრები ცალ-ცალკე ითვლება.",
    empty: "ამ პერიოდში აქტივობა არ არის.",
    invalid: "შეიყვანე ბარათის ბმული ან 64-სიმბოლოიანი კოდი.",
  },
  ru: {
    title: "Аналитика лояльности",
    year: "Год",
    program: "Программа",
    all: "Все карты",
    card: "Ссылка или код карты клиента (необязательно)",
    apply: "Показать карту",
    clear: "Все клиенты",
    activated: "Активировано карт",
    stamps: "Выдано штампов",
    earned: "Заработано наград",
    redeemed: "Получено наград",
    loading: "Загрузка аналитики…",
    note: "Месячные итоги по времени Тбилиси. Активация — регистрация, для программы — первое участие. Выданные штампы включают впоследствии отменённые. Заработанные и полученные награды считаются отдельно.",
    empty: "В этом периоде нет активности.",
    invalid: "Введите ссылку на карту или её 64-символьный код.",
  },
};
export default function Analytics({
  token,
  lang,
  programs,
}: {
  token: string;
  lang: CustomerLanguage;
  programs: { _id: Id<"loyaltyPrograms">; name: string }[];
}) {
  const t = copy[lang];
  const [year, setYear] = useState(
    new Date(Date.now() + 4 * 3600_000).getUTCFullYear(),
  );
  const [program, setProgram] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const data = useQuery(api.loyalty.analytics, {
    token,
    year,
    programId: program ? (program as Id<"loyaltyPrograms">) : undefined,
    code: code || undefined,
  });
  return (
    <section>
      <h2>{t.title}</h2>
      <div className="loyalty-actions">
        <label>
          {t.year}
          <input
            aria-label={t.year}
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 2020 && n <= 2100) setYear(n);
            }}
          />
        </label>
        <label>
          {t.program}
          <select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">{t.all}</option>
            {programs.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        className="loyalty-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(
            new FormData(e.currentTarget).get("card") ?? "",
          ).trim();
          const id = value.match(
            /(?:^|\/(?:loyalty\/card|c)\/)([a-f0-9]{64}|[A-Za-z0-9_-]{22})$/,
          )?.[1];
          if (!id) {
            setError(t.invalid);
            return;
          }
          setCode(id);
          setError("");
        }}
      >
        <label>
          {t.card}
          <input name="card" />
        </label>
        <div className="loyalty-actions">
          <button>{t.apply}</button>
          <button
            type="reset"
            onClick={() => {
              setCode("");
              setError("");
            }}
          >
            {t.clear}
          </button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="loyalty-muted">{t.note}</p>
      {!data ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {Object.values(data.totals).every((n) => n === 0) && <p>{t.empty}</p>}
          {(["activated", "stamps", "earned", "redeemed"] as const).map(
            (key) => {
              const max = Math.max(1, ...data.months.map((m) => m[key]));
              const points = data.months.map((m, i) => ({
                x: 48 + i * 58,
                y: 190 - (m[key] / max) * 150,
                value: m[key],
                label: new Date(Date.UTC(year, i, 1)).toLocaleDateString(lang, {
                  month: "short",
                  timeZone: "UTC",
                }),
              }));
              const path = points
                .map((p, i) =>
                  i === 0
                    ? `M ${p.x} ${p.y}`
                    : `C ${points[i - 1].x + 29} ${points[i - 1].y}, ${p.x - 29} ${p.y}, ${p.x} ${p.y}`,
                )
                .join(" ");
              return (
                <section key={key}>
                  <h3>
                    {t[key]} · {data.totals[key].toLocaleString(lang)}
                  </h3>
                  <svg
                    className="analytics-chart"
                    viewBox="0 0 730 240"
                    role="img"
                    aria-label={`${t[key]}, ${year}`}
                  >
                    <text x="4" y="44">
                      {max}
                    </text>
                    <text x="16" y="194">
                      0
                    </text>
                    <path
                      d="M 42 190 H 704"
                      stroke="currentColor"
                      opacity=".2"
                    />
                    <path d={path} className="chart-line" />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4">
                          <title>
                            {p.label}: {p.value}
                          </title>
                        </circle>
                        <text x={p.x} y={p.y - 12} textAnchor="middle">
                          {p.value}
                        </text>
                        <text x={p.x} y="222" textAnchor="middle">
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </section>
              );
            },
          )}
          <details>
            <summary>
              {year} · {t.title}
            </summary>
            <div className="loyalty-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.year}</th>
                    {(
                      ["activated", "stamps", "earned", "redeemed"] as const
                    ).map((k) => (
                      <th key={k}>{t[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}>
                      <th>
                        {year}-{String(m.month).padStart(2, "0")}
                      </th>
                      <td>{m.activated}</td>
                      <td>{m.stamps}</td>
                      <td>{m.earned}</td>
                      <td>{m.redeemed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
