"use client";
import { useEffect, useRef, useState } from "react";
import { activationCopy } from "@/lib/loyalty/activation-copy";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
export default function WelcomeAnimation({
  code,
  lang,
  onProgress,
}: {
  code: string;
  lang: CustomerLanguage;
  onProgress: (n: number | null) => void;
}) {
  const timersRef=useRef<ReturnType<typeof setTimeout>[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState("off");
  const [picked, setPicked] = useState<number | null>(null);
  const a = activationCopy[lang];
  useEffect(() => {
    const url=new URL(location.href);
    let welcome=url.searchParams.get("welcome")==="1";
    try { welcome=welcome||sessionStorage.getItem("suro-welcome")===code;sessionStorage.removeItem("suro-welcome"); }catch{}
    if(!welcome)return;
    url.searchParams.delete("welcome");
    history.replaceState(history.state,"",url.pathname+url.search);
    setStage("thanks");
    onProgress(0);
    const timers = [
      setTimeout(() => {
        setStage("stamp");
        onProgress(1);
      }, 1800),
      setTimeout(() => setStage("gift"), 4800),
      setTimeout(() => setStage("shuffle"), 5800),
      setTimeout(() => setStage("pick"), 7600),
    ];
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [code, onProgress]);
  useEffect(() => {
    if (stage === "off") return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        timersRef.current.forEach(clearTimeout);
        setStage("off");
        onProgress(null);
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        if (!buttons.length) {
          e.preventDefault();
          return;
        }
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
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
  }, [stage, onProgress]);
  if (stage === "off") return null;
  return (
    <div
      className={`welcome-celebration stage-${stage}`}
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={a.thanks}
    >
      <div className="welcome-visual" aria-live="polite">
        <h2>
          {stage === "thanks" || stage === "stamp"
            ? a.thanks
            : stage === "won"
              ? a.won
              : stage === "pick"
                ? a.pick
                : a.gift}
        </h2>
        {(stage === "stamp" || stage === "won") && (
          <div
            className="welcome-seal"
            aria-label={stage === "won" ? "2" : "1"}
          >
            <span className="loyalty-mark" />
          </div>
        )}
        {(stage === "gift" || stage === "won") && (
          <svg
            className="welcome-gift"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7C5 7 5 1 9 3c2 1 3 4 3 4Zm0 0c7 0 7-6 3-4-2 1-3 4-3 4Z" />
          </svg>
        )}
        {(stage === "shuffle" || stage === "pick" || picked !== null) && (
          <div className="welcome-cups">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                className={picked === i ? "cup-picked" : ""}
                disabled={stage !== "pick"}
                aria-label={`${a.pick} ${i + 1}`}
                onClick={() => {
                  setPicked(i);
                  setStage("won");
                  onProgress(2);
                }}
              >
                <svg
                  viewBox="0 0 72 80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 68 20 18h32l8 50H12ZM8 69h56M23 12h26" />
                </svg>
              </button>
            ))}
          </div>
        )}
        {stage === "won" && (
          <button
            autoFocus
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
    </div>
  );
}
