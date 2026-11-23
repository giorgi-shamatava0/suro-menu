"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { activationCopy } from "@/lib/loyalty/activation-copy";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";

type Stage =
  | "off"
  | "empty"
  | "thanks"
  | "stamp"
  | "gift"
  | "shuffle"
  | "pick"
  | "reveal"
  | "won";
export default function WelcomeAnimation({
  code,
  lang,
  onProgress,
  welcomeStamps = 2,
}: {
  welcomeStamps?: number;
  code: string;
  lang: CustomerLanguage;
  onProgress: (n: number | null) => void;
}) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const requested = useRef<boolean | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("off");
  const [picked, setPicked] = useState<number | null>(null);
  const a = activationCopy[lang];
  const game = ["gift", "shuffle", "pick", "reveal"].includes(stage);

  useLayoutEffect(() => {
    const url = new URL(location.href);
    if (requested.current === null) {
      requested.current = url.searchParams.get("welcome") === "1";
      try {
        requested.current ||= sessionStorage.getItem("suro-welcome") === code;
        sessionStorage.removeItem("suro-welcome");
      } catch {}
    }
    if (!requested.current) return;
    url.searchParams.delete("welcome");
    history.replaceState(
      history.state,
      "",
      url.pathname + url.search + url.hash,
    );
    onProgress(0);
    setStage("empty");
    const after = (delay: number, action: () => void) =>
      setTimeout(action, delay);
    timers.current = [
      after(2000, () => setStage("thanks")),
      after(2900, () => {
        setStage("stamp");
        onProgress(1);
      }),
      // Allow the 600ms impression to settle, then hold the card for 3 seconds.
      ...(welcomeStamps > 1
        ? [
            after(6500, () => setStage("gift")),
            after(7700, () => setStage("shuffle")),
            after(9500, () => setStage("pick")),
          ]
        : [
            after(6500, () => {
              setStage("off");
              onProgress(null);
            }),
          ]),
    ];
    return () => timers.current.forEach(clearTimeout);
  }, [code, onProgress, welcomeStamps]);

  useEffect(() => {
    if (!game) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        timers.current.forEach(clearTimeout);
        setStage("off");
        onProgress(null);
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (!buttons.length) e.preventDefault();
        else if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [game, onProgress]);

  if (stage === "off") return null;
  if (!game)
    return (
      <div
        className={`welcome-card-message stage-${stage}`}
        role="status"
        aria-live="polite"
      >
        {stage !== "empty" && (
          <p key={stage === "won" ? "won" : "thanks"}>
            {stage === "won"
              ? {
                  ka: `${welcomeStamps - 1} შტამპი საჩუქრად!`,
                  en: `${welcomeStamps - 1} gift ${welcomeStamps === 2 ? "stamp" : "stamps"}!`,
                  ru: `Штампы в подарок: ${welcomeStamps - 1}!`,
                }[lang]
              : a.thanks}
          </p>
        )}
        {stage === "won" && (
          <button
            className="loyalty-primary"
            onClick={() => {
              setStage("off");
              onProgress(null);
            }}
          >
            {a.close}
          </button>
        )}
      </div>
    );
  return (
    <div
      className={`welcome-celebration stage-${stage}`}
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={a.gift}
    >
      <div className="welcome-visual" aria-live="polite">
        <h2 key={stage === "pick" ? "pick" : "gift"}>
          {stage === "pick" ? a.pick : a.gift}
        </h2>
        <div className="welcome-cups">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={picked === i ? "cup-picked" : ""}
              disabled={stage !== "pick"}
              aria-label={`${a.pick} ${i + 1}`}
              onClick={() => {
                if (picked !== null) return;
                setPicked(i);
                setStage("reveal");
                timers.current.push(
                  setTimeout(() => {
                    setStage("won");
                    onProgress(welcomeStamps);
                  }, 1200),
                );
              }}
            >
              <span className="cup-prize" aria-hidden="true">
                <span className="loyalty-mark" />
              </span>
              <img
                className="cup-model"
                src="/decor/game-cup.webp"
                width="256"
                height="256"
                alt=""
                draggable={false}
              />
              <span className="cup-shadow" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
