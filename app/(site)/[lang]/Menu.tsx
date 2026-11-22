"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { hero, plates, stems } from "@/lib/decor";
import { type Lang, type UiKey } from "@/lib/i18n";
import Footer from "./Footer";
import Hero, { LangPicker } from "./Hero";
import { Icon, Price, Row, tagIcon, zoomSizes } from "./Row";
import type { LocalMenu, MenuItem } from "@/lib/menu";
import { titleStyle } from "@/lib/localize";

type T = Record<UiKey, string>;
type Props = { lang: Lang; t: T; menu: LocalMenu };

const FILTERS = ["vegan", "vegetarian", "spicy", "gluten-free"];
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const matches = (it: MenuItem, f: string[]) => f.every((k) => it.tags.includes(k) || (k === "vegetarian" && it.tags.includes("vegan")));

export default function Menu({ lang, t, menu }: Props) {
  const { sections, settings: s } = menu;
  const [filters, setFilters] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inMenu, setInMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [zoom, setZoom] = useState<MenuItem | null>(null);
  const indexRef = useRef<HTMLDialogElement>(null);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => sections.flatMap((sec) => sec.cats.flatMap((c) => c.items.map((it) => ({ it, cat: c, sec })))), [sections]);
  const presentFilters = FILTERS.filter((f) => all.some(({ it }) => matches(it, [f])));
  const visible = (items: MenuItem[]) => (filters.length ? items.filter((it) => matches(it, filters)) : items);

  // scrollspy: the category crossing the line under the sticky bar is "active"
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".cat");
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id.slice(2))),
      { rootMargin: "-90px 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const heroIo = new IntersectionObserver(([e]) => { setInMenu(!e.isIntersecting); if (e.isIntersecting) setActive(null); }, { threshold: 0, rootMargin: "0px 0px -100% 0px" });
    if (heroRef.current) heroIo.observe(heroRef.current);
    return () => { io.disconnect(); heroIo.disconnect(); };
  }, [filters]);

  // the bar steps aside while you read downwards and comes back as soon as you scroll up
  useEffect(() => {
    let last = scrollY;
    const onScroll = () => {
      const d = scrollY - last;
      if (Math.abs(d) > 6) { setHidden(d > 0); last = scrollY; }
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  // keep the active chip in view inside the horizontal rail
  useEffect(() => {
    const rail = chipsRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-c="${active}"]`);
    if (!rail) return;
    const left = chip ? chip.offsetLeft - rail.clientWidth / 2 + chip.offsetWidth / 2 : 0;
    rail.scrollTo({ left, behavior: reduced() ? "auto" : "smooth" });
  }, [active]);

  // Dialogs push a history entry so the phone's back button closes them.
  useEffect(() => {
    const onPop = () => { for (const d of [indexRef.current, zoomRef.current]) if (d?.open) close(d, true); };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  function show(d: HTMLDialogElement) {
    if (d.open) return;
    d.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("in")));
    history.pushState({ dlg: d.id }, "");
  }
  function close(d: HTMLDialogElement, fromPop = false) {
    if (!d.open) return;
    d.classList.remove("in");
    setTimeout(() => d.close(), reduced() ? 0 : 380);
    if (!fromPop && history.state?.dlg) history.back();
  }
  // Leave a dialog and land somewhere on the page: swap the dialog's history entry for the target's hash.
  function jump(id: string, highlight = false) {
    const d = indexRef.current!;
    d.classList.remove("in");
    d.close();
    history.replaceState(null, "", `#${id}`);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: highlight ? "center" : "start" });
    if (highlight) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); }
  }
  function openIndex(focusSearch: boolean) {
    show(indexRef.current!);
    if (focusSearch) setTimeout(() => searchRef.current?.focus(), 60);
  }
  const toggle = (f: string) => setFilters((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  const q = query.trim().toLocaleLowerCase();
  const hits = q ? all.filter(({ it }) => matches(it, filters) && `${it.name} ${it.desc}`.toLocaleLowerCase().includes(q)).slice(0, 40) : [];

  return (
    <>
      <Hero intro lang={lang} name={t.name} menuLabel={t.menu} tagline={s.tagline} subline={s.subline}
        sections={sections.map(({ id, name }) => ({ id, name }))} heroRef={heroRef} />

      <div className={`bar${inMenu && !hidden ? " show" : ""}`} inert={!inMenu}>
        <div className="chips" ref={chipsRef}>
          {sections.map((sec) => (
            <Fragment key={sec.id}>
              <span className="chip-sec" aria-hidden="true">{sec.name}</span>
              {sec.cats.filter((c) => visible(c.items).length).map((c) => (
                <a key={c.id} href={`#c-${c.id}`} data-c={c.id} className="chip" aria-current={active === c.id ? "true" : undefined}>{c.name}</a>
              ))}
            </Fragment>
          ))}
        </div>
        {filters.length > 0 && (
          <button type="button" className="filter-pill" onClick={() => setFilters([])} aria-label={t.clear}>
            {filters.map((f) => t[`tag.${f}` as UiKey]).join(" · ")} {Icon.close}
          </button>
        )}
        <button type="button" className="bar-btn" onClick={() => openIndex(true)} aria-label={t.search}>{Icon.search}</button>
      </div>

      <main data-bg="d">
        {sections.map((sec, si) => {
          const cats = sec.cats.filter((c) => visible(c.items).length);
          if (!cats.length) return null;
          const plate = sec.decor && plates[sec.decor as keyof typeof plates];
          return (
            <section key={sec.id} className="sec" id={`s-${sec.id}`} aria-labelledby={`h-${sec.id}`}>
              <div className="sec-head wrap" data-stem={plate ? stems[sec.decor as keyof typeof plates] : undefined}>
                {plate && <Image className="deco plate" src={plate} alt="" sizes="(min-width: 900px) 420px, 62vw" />}
                <p className="sec-num">{String(si + 1).padStart(2, "0")} <span>/ {String(sections.length).padStart(2, "0")}</span></p>
                <h2 id={`h-${sec.id}`} style={titleStyle(sec.name, sec.titleSize)}>{sec.name}</h2>
                <ul className="sec-toc">
                  {cats.map((c) => <li key={c.id}><a href={`#c-${c.id}`}>{c.name}</a></li>)}
                </ul>
              </div>
              {cats.map((c) => {
                const items = visible(c.items);
                return (
                  <section key={c.id} className={`cat wrap${c.compact ? " compact" : ""}`} id={`c-${c.id}`} aria-labelledby={`h-${c.id}`}>
                    <header className="cat-head">
                      <h3 id={`h-${c.id}`}>{c.name}</h3>
                      <span className="cat-count">{items.length}</span>
                    </header>
                    {c.note && <p className="cat-note">{c.note}</p>}
                    <ul className="items">
                      {items.map((it) => <li key={it.id} id={`i-${it.id}`}><Row it={it} compact={c.compact} t={t} onOpen={() => { setZoom(it); show(zoomRef.current!); }} /></li>)}
                    </ul>
                  </section>
                );
              })}
            </section>
          );
        })}
        {filters.length > 0 && !sections.some((x) => x.cats.some((c) => visible(c.items).length)) && <p className="empty wrap">{t.nothing}</p>}
      </main>

      <Footer t={t} s={s} />


      <dialog className="index" id="index" ref={indexRef} aria-label={t.categories} onCancel={(e) => { e.preventDefault(); close(e.currentTarget); }}>
        <div className="index-inner">
          <Image className="deco index-leaves" src={hero.leaves} alt="" sizes="280px" />
          <header className="index-top">
            <button type="button" className="index-home" onClick={() => jump("top")}>{t.name}</button>
            <LangPicker lang={lang} />
            <button type="button" className="icon-btn" onClick={() => close(indexRef.current!)} aria-label={t.close}>{Icon.close}</button>
          </header>
          <label className="search">
            {Icon.search}
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} autoComplete="off" enterKeyHint="search" />
          </label>
          {presentFilters.length > 0 && (
            <div className="filters" role="group" aria-label={t.filters}>
              {presentFilters.map((f) => (
                <button key={f} type="button" className={`f-${f}`} aria-pressed={filters.includes(f)} onClick={() => toggle(f)}>{tagIcon(f)}{t[`tag.${f}` as UiKey]}</button>
              ))}
            </div>
          )}
          {q ? (
            <ul className="results" aria-live="polite">
              {hits.length ? hits.map(({ it, cat }) => (
                <li key={it.id}>
                  <button type="button" onClick={() => jump(`i-${it.id}`, true)}>
                    <span><b>{it.name}</b><em>{cat.name}</em></span><Price it={it} />
                  </button>
                </li>
              )) : <li className="empty">{t.nothing}</li>}
            </ul>
          ) : (
            <div className="toc">
              {sections.map((sec, i) => {
                const cats = sec.cats.filter((c) => visible(c.items).length);
                return cats.length > 0 && (
                  <div key={sec.id}>
                    <h4><span>0{i + 1}</span>{sec.name}</h4>
                    <ul>
                      {cats.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => jump(`c-${c.id}`)} aria-current={active === c.id ? "true" : undefined}>
                            {c.name}<span>{visible(c.items).length}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </dialog>

      <dialog className="zoom" id="zoom" ref={zoomRef} aria-label={zoom?.name} onCancel={(e) => { e.preventDefault(); close(e.currentTarget); }}
        onClick={(e) => e.target === e.currentTarget && close(e.currentTarget)}>
        {zoom?.photo && (
          <div className="zoom-card">
            {/* keyed: a new dish gets new img elements, so the last dish's photo never lingers while this one loads */}
            <div className="zoom-photo" key={zoom.photo}>
              <Image className="zoom-fill" src={zoom.photo} alt="" width={8} height={6} />
              <Image className="zoom-whole" src={zoom.photo} alt="" fill sizes={zoomSizes(640, 100)} />
            </div>
            <button type="button" className="icon-btn" onClick={() => close(zoomRef.current!)} aria-label={t.close}>{Icon.close}</button>
            <Row it={{ ...zoom, photo: null }} compact={false} t={t} />
          </div>
        )}
      </dialog>
    </>
  );
}
