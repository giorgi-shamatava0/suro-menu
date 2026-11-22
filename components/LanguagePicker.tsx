"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LANGS, type Lang } from "@/lib/i18n";
import "./language-picker.css";
const labels: Record<Lang, string> = {
  ka: "ქართული",
  en: "English",
  ru: "Русский",
};
export default function LanguagePicker({
  lang,
  mode = "menu",
}: {
  lang: Lang;
  mode?: "menu" | "cookie";
}) {
  const [cookieLanguage, setCookieLanguage] = useState(lang);
  const current = mode === "cookie" ? cookieLanguage : lang;
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    const off = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    addEventListener("pointerdown", off);
    addEventListener("keydown", escape);
    return () => {
      removeEventListener("pointerdown", off);
      removeEventListener("keydown", escape);
    };
  }, []);
  function choose(value: Lang) {
    document.cookie = `lang=${value};path=/;max-age=31536000;samesite=lax`;
    if (ref.current) ref.current.open = false;
    if (mode === "cookie") {
      setCookieLanguage(value);
      document.documentElement.lang = value;
      window.dispatchEvent(new CustomEvent("suro:language", { detail: value }));
    }
  }
  return (
    <details
      className={`lang${mode === "cookie" ? " customer-language" : ""}`}
      ref={ref}
    >
      <summary aria-label={labels[current]}>
        {mode === "cookie" ? (
          <>
            <svg
              className="language-globe"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="7.2" />
              <ellipse cx="10" cy="10" rx="3.3" ry="7.2" />
              <path d="M3 10h14" />
            </svg>
            <span>{labels[current]}</span>
            <svg
              className="language-chevron"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <path d="m3 4.5 3 3 3-3" />
            </svg>
          </>
        ) : lang === "ka" ? (
          "ქა"
        ) : (
          lang.toUpperCase()
        )}
      </summary>
      <div className="lang-pop">
        {LANGS.map((value) =>
          mode === "menu" ? (
            <Link
              key={value}
              href={path.replace(/^\/(ka|en|ru)/, `/${value}`)}
              scroll={false}
              hrefLang={value}
              lang={value}
              aria-current={value === current ? "true" : undefined}
              onClick={() => choose(value)}
            >
              {labels[value]}
            </Link>
          ) : (
            <button
              key={value}
              type="button"
              lang={value}
              data-language={value}
              aria-pressed={value === current}
              onClick={() => {
                choose(value);
              }}
            >
              {labels[value]}
            </button>
          ),
        )}
      </div>
    </details>
  );
}
