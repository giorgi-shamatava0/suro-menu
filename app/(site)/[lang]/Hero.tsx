"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { preload } from "react-dom";
import { hero, plates } from "@/lib/decor";
import { dict, type Lang } from "@/lib/i18n";
import LangPicker from "@/components/LanguagePicker";
export { LangPicker };

type Section = { id: string; name: string };
type Props = {
  lang: Lang;
  name: string;
  menuLabel: string;
  tagline: string;
  subline: string;
  sections: Section[];
  heroRef: RefObject<HTMLElement | null>;
  intro?: boolean;
};

const d = (n: number) => ({ "--d": n }) as CSSProperties;
const LOGO_COLOURS = { teal: "#5fbcac", cream: "#efe8db", white: "#ffffff" };
let booted = false; // the loader has already played in this document
const BGS = { now: "Now", a: "A lamplight", b: "B leaves", c: "C stone", d: "D stone+leaves", e: "E leaves on dark stone", f: "F mix" };

/* The curtain: each plant picture once. Every stem and cut edge sits past the screen edge, and each
   piece enters and leaves along the same line through its own edge, so nothing hidden comes into view. */
const CURTAIN: { src: StaticImageData; c: string }[] = [
  { src: hero.canopy, c: "c-top" },
  { src: hero.vine, c: "c-bottom" },
  { src: plates["pothos-cascade"], c: "c-tr" },
  { src: hero.leaves, c: "c-scatter" },
  { src: plates["fern-frond"], c: "c-bl" },
  { src: plates["monstera-a"], c: "c-left" },
  { src: plates["monstera-b"], c: "c-right" },
];

// Decorative assets must never gate the header or its controls. The curtain is
// only a first-visit enhancement on small screens; desktop reveals immediately.
const START = `(function(){var h=document.documentElement,lab=/[?&]lab/.test(location.search),seen=0;
try{seen=!lab&&sessionStorage.getItem("suro-intro");sessionStorage.setItem("suro-intro","1")}catch(e){}
if(seen||matchMedia("(min-width: 900px), (prefers-reduced-motion: reduce)").matches)h.classList.add("seen");
h.classList.remove("wait");h.classList.add("intro-go")})()`;

function LabPanel() {
  const [on, setOn] = useState(false);
  const [bg, setBg] = useState<string | null>(null);
  useEffect(() => {
    setOn(/[?&]lab/.test(location.search));
    // the other versions (?bg) are for choosing on localhost/previews only; production always shows D
    if (process.env.BG_LAB) try { setBg(new URLSearchParams(location.search).get("bg") ?? sessionStorage.getItem("suro-bg")); } catch {}
    try { const c = localStorage.getItem("suro-logo"); if (c) document.documentElement.style.setProperty("--logo", c); } catch {}
  }, []);
  // menu background versions: ?bg=now|a|…|f, switchable from the panel (D is the default)
  useEffect(() => {
    if (!bg) return;
    try { sessionStorage.setItem("suro-bg", bg); } catch {}
    document.querySelectorAll("main").forEach((m) => { if (bg !== "now") m.dataset.bg = bg; else delete m.dataset.bg; });
  }, [bg]);
  if (bg !== null)
    return (
      <div className="lab" role="group" aria-label="Background versions" style={{ top: "auto", bottom: 12 }}>
        {Object.entries(BGS).map(([k, label]) => (
          <a key={k} href={`?bg=${k}`} aria-current={bg === k ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); setBg(k); history.replaceState(history.state, "", `?bg=${k}`); }}>{label}</a>
        ))}
      </div>
    );
  if (!on) return null;
  const colour = (c: string) => { document.documentElement.style.setProperty("--logo", c); try { localStorage.setItem("suro-logo", c); } catch {} };
  return (
    <div className="lab" role="group" aria-label="Test panel">
      <button type="button" onClick={() => location.reload()}>Replay</button>
      {Object.entries(LOGO_COLOURS).map(([k, c]) => (
        <button key={k} type="button" onClick={() => colour(c)}><i style={{ background: c }} />{k}</button>
      ))}
    </div>
  );
}

export default function Hero({ lang, name, menuLabel, tagline, subline, sections, heroRef, intro = true }: Props) {
  preload("/logo-mask.png", { as: "image", fetchPriority: "high" });
  // A language switch mounts a fresh page and resets <html>'s classes, which brought the loader's dark curtain back.
  useLayoutEffect(() => {
    if (booted) document.documentElement.classList.add("seen");
    booted = true;
  }, []);
  return (
    <>
      {/* the admin preview is drawn in the browser, where an inline script would never run: it gets no loader at all */}
      {intro && (
        <>
          <div className="intro" aria-hidden="true">
            {CURTAIN.map(({ src, c }) => <Image key={c} className={c} src={src} alt="" loading="lazy" sizes={c === "c-top" || c === "c-bottom" ? "100vw" : "(min-width: 900px) 640px, 75vw"} />)}
          </div>
          <script dangerouslySetInnerHTML={{ __html: START }} />
        </>
      )}
      <noscript><style>{".intro{display:none}.hero *{animation:none!important}"}</style></noscript>

      <header className="hero" ref={heroRef} id="top">
        <Image className="deco canopy drift" src={hero.canopy} alt="" loading="eager" sizes="(min-width: 900px) 100vw, 140vw" />
        <Image className="deco basket sway" src={hero.basket} alt="" loading="eager" sizes="(min-width: 900px) 360px, 62vw" />
        <Image className="deco bulbs sway-slow" src={hero.bulbs} alt="" loading="eager" sizes="(min-width: 900px) 160px, 30vw" />
        <Image className="deco monstera drift" src={hero.monstera} alt="" loading="eager" sizes="(min-width: 900px) 560px, 68vw" />
        <Image className="deco pothos sway-slow" src={plates["pothos-cascade"]} alt="" loading="eager" sizes="(min-width: 900px) 200px, 30vw" />
        <Image className="deco frond drift" src={plates["fern-frond"]} alt="" loading="eager" sizes="(min-width: 900px) 460px, 70vw" />
        <div className="hero-lang"><LangPicker lang={lang} /></div>

        <div className="hero-copy">
          <h1 className="logo rise"><span className="sr">{name}</span></h1>
          {tagline && <p className="tagline rise" style={d(1)}>{tagline}{subline && <small>{subline}</small>}</p>}
          {sections[0] && <a className="to-menu rise" style={d(2)} href={`#s-${sections[0].id}`}>{menuLabel}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></a>}
        </div>
      </header>

      <LabPanel />
    </>
  );
}
