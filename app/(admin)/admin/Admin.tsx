"use client";

import type { OptimisticLocalStore } from "convex/browser";
import { ConvexProvider, ConvexReactClient, useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { publishMenu } from "@/app/actions";
import { cropVars, Row } from "@/app/(site)/[lang]/Row";
import Cropper, { onScreen } from "./Crop";
import { plates, stems } from "@/lib/decor";
import { dict, type Lang } from "@/lib/i18n";
import { fromTree, localize, titleStyle } from "@/lib/localize";

const client = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const TOKEN_KEY = "suro-admin";
const SLOTS = [1, 2, 3, 4, 5];

type Tr = { ka?: string; en?: string; ru?: string };
type Tree = FunctionReturnType<typeof api.admin.tree>;
type Versions = FunctionReturnType<typeof api.admin.versions>;
type Item = Tree["items"][number];
type Display = "none" | "small" | "original" | "big";
type Panel = { kind: "category"; id: Id<"categories"> } | { kind: "item"; id: Id<"items"> } | null;
type OnDraft = (d: object) => void;

const LANGS = [["ka", "ქა"], ["en", "EN"], ["ru", "RU"]] as const;
const TAGS = [["vegan", "Vegan"], ["vegetarian", "Vegetarian"], ["signature", "Signature"], ["spicy", "Spicy"], ["gluten-free", "Gluten-free"], ["new", "New"]] as const;
const LAYOUTS: [Display, string, ReactNode][] = [
  ["none", "No photo", <svg key="n" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 5h16M2 9h11M2 13h13" /></svg>],
  ["small", "Small", <svg key="s" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 5h10M2 9h7M2 13h8" /><rect x="15" y="3" width="7" height="7" rx="1.5" /></svg>],
  ["original", "Small original", <svg key="o" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 5h8M2 9h6M2 13h7" /><rect x="12" y="3" width="10" height="7" rx="1.5" /></svg>],
  ["big", "Big", <svg key="b" viewBox="0 0 24 18" aria-hidden="true"><rect x="2" y="1" width="20" height="10" rx="1.5" /><path d="M2 14h13M2 17h8" /></svg>],
];

// section title sizes (undefined = Auto: as big as fits, like before)
const TITLE_SIZES: [Doc<"sections">["titleSize"], string][] = [[undefined, "Auto"], ["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]];

// the frames the guest menu crops photos to (site.css .item .photo)
const FRAMES: Record<Display, string> = {
  none: "The photo is kept but not shown on the menu.",
  small: "Square frame (1:1), beside the name. Upload at least 600 × 600 px.",
  original: "Whole picture, no crop. Same height as Small; width follows the original proportions and fits the available space.",
  big: "Landscape frame (4:3), full width. Upload at least 1200 × 900 px.",
};

/* What a new row is called: an example of what belongs there (typing replaces it, the name comes up selected).
   Sections suggest their categories, categories their dishes. */
type Ex = { name: Required<Tr>; kids?: Ex[] };
const ex = (ka: string, en: string, ru: string, kids?: Ex[]): Ex => ({ name: { ka, en, ru }, kids });
const EXAMPLES: Ex[] = [
  ex("კერძები", "Food", "Еда", [
    ex("სალათები", "Salads", "Салаты", [ex("ცეზარი", "Caesar salad", "Цезарь"), ex("ბერძნული სალათი", "Greek salad", "Греческий салат")]),
    ex("სუპები", "Soups", "Супы", [ex("ჩიხირთმა", "Chikhirtma", "Чихиртма"), ex("სოკოს სუპი", "Mushroom soup", "Грибной суп")]),
    ex("ცხელი კერძები", "Hot dishes", "Горячие блюда", [ex("ხინკალი", "Khinkali", "Хинкали"), ex("შქმერული", "Shkmeruli", "Шкмерули")]),
    ex("წასახემსებელი", "Snacks", "Закуски", [ex("კარტოფილი ფრი", "French fries", "Картофель фри")]),
  ]),
  ex("სასმელები", "Drinks", "Напитки", [
    ex("ყავა", "Coffee", "Кофе", [ex("კაპუჩინო", "Cappuccino", "Капучино"), ex("ესპრესო", "Espresso", "Эспрессо")]),
    ex("ჩაი", "Tea", "Чай", [ex("შავი ჩაი", "Black tea", "Чёрный чай"), ex("მწვანე ჩაი", "Green tea", "Зелёный чай")]),
    ex("ლიმონათები", "Lemonades", "Лимонады", [ex("ტარხუნის ლიმონათი", "Tarragon lemonade", "Тархун")]),
    ex("ღვინო", "Wine", "Вино", [ex("საფერავი", "Saperavi", "Саперави")]),
  ]),
  ex("ტკბილეული", "Sweets", "Сладкое", [
    ex("ნამცხვრები", "Cakes", "Торты", [ex("ნაპოლეონი", "Napoleon", "Наполеон"), ex("ჩიზქეიქი", "Cheesecake", "Чизкейк")]),
    ex("ნაყინი", "Ice cream", "Мороженое", [ex("ვანილის ნაყინი", "Vanilla ice cream", "Ванильное мороженое")]),
  ]),
  ex("საუზმე", "Breakfast", "Завтраки", [
    ex("კვერცხი", "Eggs", "Яйца", [ex("ომლეტი", "Omelette", "Омлет"), ex("ერბოკვერცხი", "Fried eggs", "Яичница")]),
  ]),
];
const same = (a?: Tr, b?: Tr) => !!a && !!b && ((!!a.en && a.en === b.en) || (!!a.ka && a.ka === b.ka));
const exFor = (name: Tr | undefined, list: Ex[]) => list.find((e) => same(e.name, name));
// the first example not used yet among the siblings, else the plain name
const pick = (list: Ex[], used: (Tr | undefined)[], plain: Required<Tr>) => list.find((e) => !used.some((u) => same(e.name, u)))?.name ?? plain;

// ka first, as on the site
const label = (t?: Tr) => t?.ka || t?.en || t?.ru || "Untitled";
const filled = (t?: Tr) => !!(t && (t.ka?.trim() || t.en?.trim() || t.ru?.trim()));
const flip = (list: string[] | undefined, k: string) => (list?.includes(k) ? list.filter((x) => x !== k) : [...(list ?? []), k]);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const when = (at: number) => new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Drop empty strings and undefined fields: the server replaces the whole record, so what is left out is cleared.
function clean<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && ("ka" in v || "en" in v || "ru" in v)) {
      const t = Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === "string" && s.trim()));
      if (Object.keys(t).length) out[k] = t;
      continue;
    }
    out[k] = v;
  }
  return out as T;
}
const strip = <T extends { _id: unknown; _creationTime: number; order?: number }>({ _id, _creationTime, order, ...rest }: T) => rest;

// A save shows in the editor at once; the server's copy replaces it a moment later.
const optimistic = (key: "sections" | "categories" | "items") => (store: OptimisticLocalStore, a: { token: string; id?: string; data: object }) => {
  const t = store.getQuery(api.admin.tree, { token: a.token });
  if (!t || !a.id) return;
  const rows = (t[key] as { _id: string; _creationTime: number; order: number; photo?: string; photoUrl?: string | null }[]).map((r) =>
    r._id !== a.id ? r : { _id: r._id, _creationTime: r._creationTime, order: r.order, ...a.data, ...("photoUrl" in r && { photoUrl: (a.data as { photo?: string }).photo === r.photo ? r.photoUrl : null }) },
  );
  store.setQuery(api.admin.tree, { token: a.token }, { ...t, [key]: rows } as Tree);
};
const reordered = (store: OptimisticLocalStore, { token, ids }: { token: string; ids: string[] }) => {
  const t = store.getQuery(api.admin.tree, { token });
  if (!t) return;
  const pos = new Map(ids.map((id, i) => [id, i]));
  const re = <X extends { _id: string; order: number }>(xs: X[]) => xs.map((x) => (pos.has(x._id) ? { ...x, order: pos.get(x._id)! } : x)).sort((a, b) => a.order - b.order);
  store.setQuery(api.admin.tree, { token }, { ...t, sections: re(t.sections), categories: re(t.categories), items: re(t.items) });
};

// Photos are shrunk on the laptop before upload: at most 1600px, WebP.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Could not read this image"))), "image/webp", 0.86));
}

export default function Admin() {
  return (
    <ConvexProvider client={client}>
      <Gate />
    </ConvexProvider>
  );
}

function Gate() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setToken(localStorage.getItem(TOKEN_KEY)); } catch {}
    setReady(true);
  }, []);
  const ok = useQuery(api.auth.check, token ? { token } : "skip");
  if (!ready || (token && ok === undefined)) return <div className="splash" />;
  if (!token || ok === false)
    return <Login onToken={(t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} setToken(t); }} />;
  return <Editor token={token} onLogout={() => { try { localStorage.removeItem(TOKEN_KEY); } catch {} setToken(null); }} />;
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const login = useAction(api.auth.login);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      onToken(await login({ password: pw }));
    } catch (x) {
      const d = x instanceof ConvexError ? (x.data as { code?: string; until?: number }) : null;
      setErr(d?.code === "locked" ? `Too many attempts. Try again after ${new Date(d.until!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : d?.code === "wrong" ? "That password is not right." : "Could not sign in. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <span className="mark" role="img" aria-label="Suro" />
        <h1>Menu editor</h1>
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby={err ? "pw-err" : undefined} />
        {err && <p className="err" id="pw-err" role="alert">{err}</p>}
        <button className="primary" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}

// One run at a time: a double click, or a click while the first call is on its way, does nothing.
function useLock() {
  const busy = useRef(false);
  return <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) => async (...a: A) => {
    if (busy.current) return;
    busy.current = true;
    try { await fn(...a); } finally { busy.current = false; }
  };
}

// Saves are tracked in one place so the top bar can say Saving / Saved.
function useSaver() {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [msg, setMsg] = useState("");
  const pending = useRef(0);
  function track<R>(p: Promise<R>) {
    pending.current++;
    setState("saving");
    return p.then(
      (r) => {
        if (--pending.current === 0) setState("idle");
        return r;
      },
      (e) => {
        pending.current--;
        setState("error");
        setMsg(e instanceof ConvexError ? String(e.data) : "Could not save. Check the connection.");
        throw e;
      },
    );
  }
  return { state, msg, track, say: (m: string) => { setState("error"); setMsg(m); } };
}
type Track = ReturnType<typeof useSaver>["track"];

/* Everything here edits the draft. Publish puts the draft on the site and keeps it in one of 5 version slots. */
function Editor({ token, onLogout }: { token: string; onLogout: () => void }) {
  const tree = useQuery(api.admin.tree, { token });
  const versions = useQuery(api.admin.versions, { token });
  const logout = useMutation(api.auth.logout);
  const publishM = useMutation(api.admin.publish);
  const restoreM = useMutation(api.admin.restore);
  const publishVersionM = useMutation(api.admin.publishVersion);
  const removeVersionM = useMutation(api.admin.removeVersion);
  const clearDraftM = useMutation(api.admin.clearDraft);
  const { state, msg, track, say } = useSaver();
  const [view, setView] = useState<"menu" | "cafe">("menu");
  const [lang, setLang] = useState<Lang>("ka");
  const [dlg, setDlg] = useState<null | "versions" | "full">(null);
  const [done, setDone] = useState("");
  const [peek, setPeek] = useState<number | null>(null);
  const lock = useLock();
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (state === "saving") e.preventDefault(); };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [state]);

  const publish = lock(async (slot?: number) => {
    const target = slot ?? SLOTS.find((n) => !versions?.slots.some((s) => s.slot === n));
    if (!target) return setDlg("full");
    setDlg(null);
    await track(publishM({ token, slot: target }));
    publishMenu(token).catch(() => say("Published, but the site could not be refreshed. Publish again."));
    setDone(`Published · saved as version ${target}`);
    setTimeout(() => setDone(""), 4000);
  });
  const removeVersion = lock(async (slot: number) => {
    const s = versions?.slots.find((x) => x.slot === slot);
    if (!(await ask({ title: `Delete version ${slot}${s?.name ? ` “${s.name}”` : ""}?`, body: "This saved copy of the menu is gone for good. Your draft and the site don't change.", yes: "Delete version", danger: true }))) return;
    await track(removeVersionM({ token, slot }));
  });
  const createMenu = lock(async () => {
    const body = versions?.changed
      ? "The editor starts empty and your unpublished changes are lost. Saved versions, café info and the site stay as they are."
      : "The editor starts empty. Saved versions, café info and the site stay as they are until you publish.";
    if (!(await ask({ title: "Start a new menu from scratch?", body, yes: "Start empty", danger: !!versions?.changed }))) return;
    setDlg(null);
    setPeek(null);
    setView("menu");
    await track(clearDraftM({ token }));
  });
  const publishSaved = lock(async (slot: number) => {
    if (!(await ask({ title: `Put version ${slot} on the site?`, body: "Guests will see this version. Your draft stays as it is.", yes: "Publish" }))) return;
    await track(publishVersionM({ token, slot }));
    publishMenu(token).catch(() => say("Published, but the site could not be refreshed. Publish again."));
    setDone(`Version ${slot} is on the site`);
    setTimeout(() => setDone(""), 4000);
  });
  const restore = lock(async (slot: number) => {
    if (versions?.changed && !(await ask({ title: `Open version ${slot} in the editor?`, body: "Your unpublished changes will be replaced by this version.", yes: "Open version" }))) return;
    setDlg(null);
    setPeek(null);
    await track(restoreM({ token, slot }));
    setDone(`Version ${slot} is in the editor. Publish to put it on the site.`);
    setTimeout(() => setDone(""), 5000);
  });

  const status = state === "saving" ? "Saving…" : state === "error" ? msg : done || (versions?.changed ? "Unpublished changes" : "Everything is on the site");
  return (
    <div className={`app${peek ? " peeking" : ""}`}>
      <header className="top">
        <span className="mark" role="img" aria-label="Suro" />
        <nav className="seg views" aria-label="Editor">
          <button aria-pressed={view === "menu"} onClick={() => setView("menu")}>Menu</button>
          <button aria-pressed={view === "cafe"} disabled={!!peek} onClick={() => setView("cafe")}>Café info</button>
        </nav>
        {view === "menu" && (
          <div className="seg" role="group" aria-label="Language the menu is shown in">
            {LANGS.map(([l, short]) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{short}</button>)}
          </div>
        )}
        <p className={`status${state === "error" ? " is-error" : versions?.changed && !done ? " is-changed" : ""}`} role="status">{status}</p>
        <a className="ghost" href="/admin/loyalty">Loyalty</a>
        <button className="ghost" onClick={() => setDlg("versions")}>Versions</button>
        <a className="ghost" href="/" target="_blank" rel="noopener">View site</a>
        <button className="primary" disabled={!versions?.changed || state === "saving" || !!peek} onClick={() => publish()}>Publish</button>
        <button className="ghost" onClick={async () => {
          if (!(await ask({ title: "Log out of the editor?", body: "You will need the password to come back in.", yes: "Log out", danger: true }))) return;
          logout({ token }).catch(() => {});
          onLogout();
        }}>Log out</button>
      </header>
      {peek ? (
        <Peek token={token} slot={peek} at={versions?.slots.find((s) => s.slot === peek)?.at} name={versions?.slots.find((s) => s.slot === peek)?.name} live={versions?.live === peek} lang={lang} track={track} onBack={() => setPeek(null)} onRestore={restore} onPublish={publishSaved} />
      ) : !tree ? <div className="loading">Loading the menu…</div> : view === "menu" ? <MenuView token={token} tree={tree} track={track} lang={lang} /> : <CafeView token={token} settings={tree.settings} track={track} />}
      <AskHost />
      {dlg && versions && <VersionsDialog token={token} track={track} mode={dlg} v={versions} onClose={() => setDlg(null)} onPublish={publish} onRemove={removeVersion} onCreate={createMenu} onPeek={(n) => { setView("menu"); setPeek(n); setDlg(null); }} />}
    </div>
  );
}

/* The editor's own yes/no dialog instead of the browser popup. Cancel has the focus, so Enter or Esc never deletes. */
type Ask = { title: string; body?: string; yes: string; danger?: boolean };
let asker: (q: Ask) => Promise<boolean> = async () => false;
const ask = (q: Ask) => asker(q);

function AskHost() {
  const [q, setQ] = useState<(Ask & { done: (yes: boolean) => void }) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { asker = (a) => new Promise((done) => setQ({ ...a, done })); }, []);
  useEffect(() => { if (q) ref.current?.showModal(); }, [q]);
  if (!q) return null;
  const end = (yes: boolean) => { ref.current?.close(); setQ(null); q.done(yes); };
  return (
    <dialog ref={ref} className="dlg ask" onCancel={(e) => { e.preventDefault(); end(false); }} onClick={(e) => e.target === e.currentTarget && end(false)}>
      <div>
        <h2>{q.title}</h2>
        {q.body && <p className="hint">{q.body}</p>}
        <div className="ask-btns">
          <button className="secondary" autoFocus onClick={() => end(false)}>Cancel</button>
          <button className={q.danger ? "danger" : "primary"} onClick={() => end(true)}>{q.yes}</button>
        </div>
      </div>
    </dialog>
  );
}

function VersionsDialog({ token, track, mode, v, onClose, onPublish, onRemove, onCreate, onPeek }: { token: string; track: Track; mode: "versions" | "full"; v: Versions; onClose: () => void; onPublish: (slot: number) => void; onRemove: (slot: number) => void; onCreate: () => void; onPeek: (slot: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // open with Close focused, not the first name field
  useEffect(() => { ref.current?.showModal(); ref.current?.querySelector<HTMLElement>(".dlg-close")?.focus(); }, []);
  return (
    <dialog ref={ref} className="dlg" onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <h2>{mode === "full" ? "All 5 slots are full. Which one should this publish replace?" : "Versions"}</h2>
      <ul className="slots">
        {SLOTS.map((n) => {
          const s = v.slots.find((x) => x.slot === n);
          return (
            <li key={n}>
              <b>{n}</b>
              {s ? (
                <div className="slot-info">
                  <SlotName key={`${n}-${s.at}`} token={token} track={track} slot={n} name={s.name} />
                  <small>{when(s.at)} · {s.dishes} dishes</small>
                </div>
              ) : <i className="slot-info">Empty</i>}
              {!s && mode === "versions" && <button className="secondary" onClick={onCreate}>Create menu</button>}
              {v.live === n && <span className="live">On the site</span>}
              {mode === "full" ? (
                <button className="secondary" onClick={() => onPublish(n)}>Replace and publish</button>
              ) : s && (
                <>
                  <button className="secondary" onClick={() => onPeek(n)}>View</button>
                  {v.live !== n && (
                    <button className="icon-btn" aria-label={`Delete version ${n}`} title="Delete version" onClick={() => onRemove(n)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="dlg-foot">
        {mode === "versions" && v.slots.length === SLOTS.length && <button className="ghost" onClick={onCreate}>Start a new menu</button>}
        <button className="ghost dlg-close" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}

// A saved version, read-only; the draft stays as it is until "Open in editor".
function Peek({ token, slot, at, name, live, lang, track, onBack, onRestore, onPublish }: { token: string; slot: number; at?: number; name?: string; live: boolean; lang: Lang; track: Track; onBack: () => void; onRestore: (slot: number) => void; onPublish: (slot: number) => void }) {
  const t = useQuery(api.admin.version, { token, slot });
  return (
    <>
      <div className="peek-bar" role="status">
        <span>Looking at version {slot}{name ? ` “${name}”` : ""}{at ? ` · ${when(at)}` : ""}. Nothing here can be changed; your draft is safe.</span>
        {live ? <span className="live">On the site</span> : <button className="secondary" onClick={() => onPublish(slot)}>Publish this version</button>}
        <button className="secondary" onClick={() => onRestore(slot)}>Open in editor</button>
        <button className="primary" onClick={onBack}>Back to my draft</button>
      </div>
      {t === undefined ? <div className="loading">Loading version {slot}…</div> : !t ? <div className="loading">That slot is empty.</div> : (
        <MenuView key={slot} token={token} tree={t as unknown as Tree} track={track} lang={lang} readOnly />
      )}
    </>
  );
}

// Optional name for a saved version, saved as you type (and when the dialog closes).
function SlotName({ token, track, slot, name }: { token: string; track: Track; slot: number; name?: string }) {
  const nameVersion = useMutation(api.admin.nameVersion);
  const [d, change] = useDraft({ name: name ?? "" }, (x) => track(nameVersion({ token, slot, name: x.name })));
  return <input className="slot-name" aria-label={`Name of version ${slot}`} placeholder="Add a name (optional)" maxLength={60} value={d.name}
    onChange={(e) => change({ name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />;
}

/* Drag any row to a new place (on touch, by its ⋮⋮ grip). The row lifts off and follows the pointer,
   the others slide aside, and the new order is saved on release. A category can also be dropped on another
   section in the left panel (moveTo): that section lights up and the category moves to its end, or, over an
   open section's list, to the spot a line marks. */
function useSort(commit: (ids: string[]) => void) {
  const [drag, setDrag] = useState<{ list: string; id: string; ids: string[]; into?: string; at?: number } | null>(null);
  const before = useRef<{ box: HTMLElement; tops: Map<string, number> } | null>(null);
  const rows = (box: HTMLElement) => [...box.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.sid);
  // the rows that made room slide into place instead of jumping
  useLayoutEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b) return;
    for (const el of rows(b.box)) {
      const dy = (b.tops.get(el.dataset.sid!) ?? 0) - el.getBoundingClientRect().top;
      if (dy) el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: 180, easing: "cubic-bezier(0.2, 0.75, 0.15, 1)" });
    }
  });
  const order = <X extends { id: string }>(list: string, xs: X[]) =>
    drag?.list === list ? drag.ids.map((id) => xs.find((x) => x.id === id)).filter((x): x is X => !!x) : xs;

  function start(e: React.PointerEvent<HTMLElement>, list: string, id: string, ids: string[], moveTo?: (sectionId: string, ids?: string[]) => void) {
    const tgt = e.target as HTMLElement;
    if (e.button !== 0 || tgt.closest("input, textarea, select, label, .ed-form, button:not(.grip)") || (e.pointerType !== "mouse" && !tgt.closest(".grip"))) return;
    e.stopPropagation();
    e.preventDefault(); // no native image drag or text selection, which would cancel the pointer
    const row = e.currentTarget.closest<HTMLElement>("[data-sid]")!;
    const box = row.parentElement!;
    const scroller = box.closest<HTMLElement>(".scroll");
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: HTMLElement | null = null, ox = 0, oy = 0, cur = ids, into: string | undefined, intoAt: number | undefined, there: string[] | undefined;
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        const r = row.getBoundingClientRect();
        ox = x0 - r.left;
        oy = y0 - r.top;
        ghost = row.cloneNode(true) as HTMLElement;
        ghost.removeAttribute("data-sid");
        ghost.removeAttribute("id");
        ghost.classList.add("lifted");
        ghost.style.width = `${r.width}px`;
        box.appendChild(ghost);
        setDrag({ list, id, ids });
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - ox}px, ${ev.clientY - oy}px)`;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (ev.clientY < r.top + 60) scroller.scrollBy(0, -12);
        else if (ev.clientY > r.bottom - 60) scroller.scrollBy(0, 12);
      }
      if (moveTo) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const over = el?.closest<HTMLElement>(".side-sec")?.dataset.sid;
        const next = over && over !== list ? over : undefined;
        // over an open section's list: the drop spot is between the rows the pointer is between
        const ul = next ? el!.closest<HTMLElement>(".side-cats") : null;
        const them = ul ? rows(ul).map((r) => r.dataset.sid!) : [];
        let spot = ul && them.length ? rows(ul).findIndex((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; }) : undefined;
        if (spot === -1) spot = them.length;
        there = spot === undefined ? undefined : [...them.slice(0, spot), id, ...them.slice(spot)];
        if (next !== into || spot !== intoAt) {
          into = next;
          intoAt = spot;
          if (into) cur = ids; // over another section the list goes back to how it was
          setDrag({ list, id, ids: cur, into, at: intoAt });
        }
        if (into) return;
      }
      const rest = rows(box).filter((el) => el.dataset.sid !== id);
      let at = rest.findIndex((el) => { const b = el.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
      if (at < 0) at = rest.length;
      const next = rest.map((el) => el.dataset.sid!);
      next.splice(at, 0, id);
      if (next.join() === cur.join()) return;
      before.current = { box, tops: new Map(rows(box).map((el) => [el.dataset.sid!, el.getBoundingClientRect().top])) };
      cur = next;
      setDrag({ list, id, ids: next });
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      if (!ghost) return;
      ghost.remove();
      // the release must not also count as a click on the row
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => removeEventListener("click", swallow, { capture: true }), 0);
      if (into) moveTo!(into, there);
      else if (cur.join() !== ids.join()) commit(cur);
      setDrag(null);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }
  return { drag, order, start };
}

const Grip = () => (
  <span className="grip" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M6 3v0M10 3v0M6 8v0M10 8v0M6 13v0M10 13v0" /></svg></span>
);

// Click target in the menu: the guest markup, made pressable.
function Hit({ on, onOpen, children }: { on: boolean; onOpen: () => void; children: ReactNode }) {
  return (
    <div role="button" tabIndex={0} aria-expanded={on} className={`ed-hit${on ? " on" : ""}`} onClick={onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}>
      {children}
    </div>
  );
}

/* Left: sections, and the open section's categories (drag to reorder, click to open, + to add).
   Right: the open section drawn as guests see it; click a dish or category title to edit it. */
function MenuView({ token, tree, track, lang, readOnly }: { token: string; tree: Tree; track: Track; lang: Lang; readOnly?: boolean }) {
  const [secId, setSecId] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState<string[]>([]); // sections whose categories show in the left panel
  const [renaming, setRenaming] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [live, setLive] = useState<{ id: string; data: object } | null>(null);
  const saveSection = useMutation(api.admin.saveSection);
  const saveCategory = useMutation(api.admin.saveCategory).withOptimisticUpdate(optimistic("categories"));
  const saveItem = useMutation(api.admin.saveItem);
  const reorder = useMutation(api.admin.reorder).withOptimisticUpdate(reordered);
  const sort = useSort((ids) => track(reorder({ token, ids: ids as Id<"items">[] })));
  const canvas = useRef<HTMLDivElement>(null);
  const lock = useLock();

  // the open form's unsaved draft is drawn straight away, before its save lands
  const view = useMemo(() => {
    if (!live) return tree;
    const ov = <X extends { _id: string }>(xs: X[]) => xs.map((x) => (x._id === live.id ? { ...x, ...live.data } : x));
    return { ...tree, sections: ov(tree.sections), categories: ov(tree.categories), items: ov(tree.items) };
  }, [tree, live]);
  const menu = useMemo(() => localize(fromTree(view), lang), [view, lang]);
  const t = dict(lang);
  const sec = menu.sections.find((s) => s.id === secId) ?? menu.sections[0];
  const draftOf = (id: string): OnDraft => (data) => setLive({ id, data });

  function open(p: Panel) {
    if (readOnly && p) return;
    setLive(null);
    setPanel(p);
  }
  useEffect(() => {
    if (!panel) return;
    // Esc in a dialog only closes the dialog
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]") && open(null);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [panel]);
  const reveal = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  const isUnfolded = (id: string) => unfolded.includes(id) || (secId === null && id === sec?.id);
  // a section opens on the right and unfolds on the left; the others stay unfolded, so a category can be dragged to an exact spot in one.
  // Clicking the section already on the right folds or unfolds it.
  function openSection(id: string) {
    open(null);
    const shown = isUnfolded(id);
    setUnfolded((xs) => (id === sec?.id && shown ? xs.filter((x) => x !== id) : xs.includes(id) ? xs : [...xs, id]));
    if (id === sec?.id) return setSecId(id);
    setSecId(id);
    canvas.current?.scrollTo({ top: 0 });
  }
  const addSection = lock(async () => {
    const name = pick(EXAMPLES, tree.sections.map((s) => s.name), { ka: "ახალი განყოფილება", en: "New section", ru: "Новый раздел" });
    const id = (await track(saveSection({ token, data: { name } }))) as Id<"sections">;
    openSection(id);
    setFresh(id);
    setRenaming(id);
  });
  const addCategory = lock(async (sectionId: string) => {
    const kids = exFor(tree.sections.find((s) => s._id === sectionId)?.name, EXAMPLES)?.kids ?? EXAMPLES.flatMap((e) => e.kids ?? []);
    const name = pick(kids, tree.categories.filter((c) => c.sectionId === sectionId).map((c) => c.name), { ka: "ახალი კატეგორია", en: "New category", ru: "Новая категория" });
    const id = (await track(saveCategory({ token, data: { sectionId: sectionId as Id<"sections">, name } }))) as Id<"categories">;
    setFresh(id);
    open({ kind: "category", id });
    reveal(`c-${id}`);
  });
  const addItem = lock(async (categoryId: string) => {
    const kids = exFor(tree.categories.find((c) => c._id === categoryId)?.name, EXAMPLES.flatMap((e) => e.kids ?? []))?.kids ?? [];
    const name = pick(kids, tree.items.filter((i) => i.categoryId === categoryId).map((i) => i.name), { ka: "ახალი კერძი", en: "New dish", ru: "Новое блюдо" });
    const id = (await track(saveItem({ token, data: { categoryId: categoryId as Id<"categories">, name } }))) as Id<"items">;
    setFresh(id);
    open({ kind: "item", id });
    reveal(`i-${id}`);
  });

  const item = panel?.kind === "item" ? tree.items.find((i) => i._id === panel.id) : undefined;
  const cat = panel?.kind === "category" ? tree.categories.find((c) => c._id === panel.id) : undefined;
  const close = () => open(null);
  const form = item ? (
    <ItemForm key={item._id} token={token} item={item} compact={!!tree.categories.find((c) => c._id === item.categoryId)?.compact} track={track} onDraft={draftOf(item._id)} fresh={fresh === item._id} onClose={close} />
  ) : cat ? (
    <CategoryForm key={cat._id} token={token} cat={cat} sizes={tree.items.filter((i) => i.categoryId === cat._id).map((i) => i.display ?? "small")} track={track} onDraft={draftOf(cat._id)} fresh={fresh === cat._id} onClose={close} />
  ) : null;
  // what a section delete takes with it, counted from the draft (hidden dishes too)
  const holds = (sid: string) => {
    const cats = tree.categories.filter((c) => c.sectionId === sid).map((c) => c._id as string);
    const dishes = tree.items.filter((i) => cats.includes(i.categoryId)).length;
    return cats.length ? `${count(cats.length, "category", "categories")} and ${count(dishes, "dish", "dishes")}` : "";
  };
  const start: typeof sort.start = (...a) => { if (!readOnly) sort.start(...a); };
  // a category dropped on another section moves to its end, dishes and all; an open form for it closes so it can't save the old section back
  const moveCat = (id: string) => (sectionId: string, ids?: string[]) => {
    const c = tree.categories.find((x) => x._id === id);
    if (!c) return;
    if (panel?.id === id) open(null);
    track(saveCategory({ token, id: c._id, data: { ...strip(c), sectionId: sectionId as Id<"sections"> } }));
    // mutations from one client run in order, so this lands after the move
    if (ids) track(reorder({ token, ids: ids as Id<"items">[] }));
  };
  const dragging = (id: string) => (sort.drag?.id === id ? " ed-drag" : "");
  const sectionIds = menu.sections.map((s) => s.id);
  const plate = sec?.decor && plates[sec.decor as keyof typeof plates];

  return (
    <div className={`work${form ? " has-form" : ""}${readOnly ? " read" : ""}`}>
      <nav className="side scroll" aria-label="Sections and categories">
        <ul className="side-list" data-sort="sections">
          {sort.order("sections", menu.sections).map((s) => {
            const isOpen = s.id === sec?.id;
            const catIds = s.cats.map((c) => c.id);
            const at = sort.drag?.into === s.id ? sort.drag.at : undefined;
            return (
              <li key={s.id} data-sid={s.id} className={`side-sec${isOpen ? " open" : ""}${dragging(s.id)}${sort.drag?.into === s.id ? " drop-into" : ""}`}>
                {renaming === s.id ? (
                  <SectionForm key={s.id} token={token} sec={tree.sections.find((x) => x._id === s.id)!} holds={holds(s.id)} track={track} onDraft={draftOf(s.id)} fresh={fresh === s.id}
                    onClose={() => { setRenaming(null); setLive(null); }} />
                ) : (
                  <div className="side-row" onPointerDown={(e) => start(e, "sections", s.id, sectionIds)} onClick={() => openSection(s.id)}>
                    <Grip />
                    <span className="side-name">{s.name}</span>
                    {isOpen && <button className="side-edit" onClick={(e) => { e.stopPropagation(); setRenaming(s.id); }}>Edit</button>}
                  </div>
                )}
                {isUnfolded(s.id) && (
                  <>
                    <ul className="side-cats" data-sort={s.id}>
                      {sort.order(s.id, s.cats).map((c, ci) => (
                        <li key={c.id} data-sid={c.id} className={`${panel?.id === c.id ? "on" : ""}${dragging(c.id)}${at === ci ? " drop-at" : ""}${at === s.cats.length && ci === at - 1 ? " drop-end" : ""}`}>
                          <div className="side-row" onPointerDown={(e) => start(e, s.id, c.id, catIds, moveCat(c.id))}
                            onClick={() => { open({ kind: "category", id: c.id as Id<"categories"> }); reveal(`c-${c.id}`); }}>
                            <Grip />
                            <span className="side-name">{c.name}</span>
                            <span className="side-count">{c.items.length}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button className="side-add" onClick={() => addCategory(s.id)}>+ Category</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <button className="side-add side-add-sec" onClick={addSection}>+ Section</button>
      </nav>

      <div className="canvas scroll" lang={lang} ref={canvas} onClick={(e) => { if (!(e.target as Element).closest(".ed-box, .ed-form, .ed-add")) open(null); }}>
        {sec ? (
          <main data-bg="d" className="ed">
            <section className="sec">
              <div className="sec-head wrap" data-stem={plate ? stems[sec.decor as keyof typeof plates] : undefined}>
                {plate && <Image className="deco plate" src={plate} alt="" sizes="420px" />}
                <h2 style={titleStyle(sec.name, sec.titleSize)}>{sec.name}</h2>
              </div>
              <div data-sort={sec.id}>
                {sort.order(sec.id, sec.cats).map((c) => {
                  const itemIds = c.items.map((i) => i.id);
                  return (
                    <section key={c.id} id={`c-${c.id}`} data-sid={c.id} className={`cat wrap${c.compact ? " compact" : ""}${dragging(c.id)}`}>
                      <div className="ed-box" onPointerDown={(e) => start(e, sec.id, c.id, sec.cats.map((x) => x.id), moveCat(c.id))}>
                        <Hit on={panel?.id === c.id} onOpen={() => open({ kind: "category", id: c.id as Id<"categories"> })}>
                          <header className="cat-head">
                            <h3>{c.name}{c.compact && <span className="ed-mark">Short list</span>}</h3>
                            <span className="cat-count">{c.items.length}</span>
                          </header>
                        </Hit>
                      </div>
                      <ul className="items" data-sort={c.id}>
                        {sort.order(c.id, c.items).map((it) => (
                          <li key={it.id} id={`i-${it.id}`} data-sid={it.id} className={`ed-box${dragging(it.id)}`} onPointerDown={(e) => start(e, c.id, it.id, itemIds)}>
                            <Grip />
                            <Hit on={panel?.id === it.id} onOpen={() => open({ kind: "item", id: it.id as Id<"items"> })}>
                              <Row it={it} compact={c.compact} t={t} />
                            </Hit>
                          </li>
                        ))}
                      </ul>
                      <button className="ed-add" onClick={() => addItem(c.id)}>+ Add a dish</button>
                    </section>
                  );
                })}
              </div>
              {!sec.cats.length && <p className="wrap ed-guide">A section holds categories, for example Salads and Soups under Food, or Coffee and Tea under Drinks.</p>}
              <div className="wrap"><button className="ed-add ed-add-cat" onClick={() => addCategory(sec.id)}>+ Add a category</button></div>
            </section>
          </main>
        ) : !readOnly && (
          <div className="menu-empty">
            <h2>Your menu is empty</h2>
            <p>A menu has sections (Food, Drinks), sections have categories (Salads, Coffee), and categories have dishes with their prices.</p>
            <button className="primary" onClick={addSection}>+ Add the first section</button>
          </div>
        )}
      </div>

      {!readOnly && <aside className="side-form scroll" aria-label="Edit">
        {form ?? (
          <div className="form-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
            <p>Nothing selected</p>
            <span>{menu.sections.length ? "Click a dish or a category in the menu to edit it here." : "Add a section first; its form opens on the left."}</span>
          </div>
        )}
      </aside>}
    </div>
  );
}

/* One draft per open record. Each change shows at once and is saved 600ms after typing stops
   (clicks after 200ms, so a burst of clicks is one save); closing the form saves what is pending first. */
function useDraft<T>(initial: T, save: (d: T) => Promise<unknown> | undefined, onDraft?: OnDraft) {
  const [d, setD] = useState(initial);
  const latest = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;
  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    saveRef.current(latest.current)?.catch(() => {});
  };
  useEffect(() => {
    // closing the tab inside the debounce would lose the last change
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { flush(); e.preventDefault(); } };
    addEventListener("beforeunload", warn);
    return () => { removeEventListener("beforeunload", warn); flush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function change(patch: Partial<T>, now = false) {
    latest.current = { ...latest.current, ...patch };
    dirty.current = true;
    setD(latest.current);
    onDraft?.(latest.current as object);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, now ? 200 : 600);
  }
  return [d, change] as const;
}

// The form comes into view with the Georgian name focused; a just-added record has it selected, ready to be typed over.
function useFresh(fresh: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLInputElement>("input[lang=ka]");
    if (fresh) el?.select();
    el?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fresh, ref]);
}

// shortcut: two layouts for the names while the owner chooses (/admin = all languages, /admin?form=tabs = tabs); drop the loser and this flag
const TABS = typeof location !== "undefined" && new URLSearchParams(location.search).get("form") === "tabs";

// Name (and, for full dishes, description) in all three languages: every language at once, or one tab per language.
function Langs({ name, desc, onName, onDesc, tabs = TABS }: { name?: Tr; desc?: Tr; onName: (v: Tr) => void; onDesc?: (v: Tr) => void; tabs?: boolean }) {
  const [cur, setCur] = useState<keyof Tr>("ka");
  const miss = (k: keyof Tr) => (name?.[k]?.trim() ? "" : "missing");
  if (tabs) {
    const short = LANGS.find(([k]) => k === cur)![1];
    return (
      <div className="grp">
        <div className="tabs" role="tablist" aria-label="Language">
          {LANGS.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} className={miss(k)} onClick={() => setCur(k)}>{l}</button>)}
        </div>
        <label className="fld"><span>Name</span><input lang={cur} aria-label={`Name, ${short}`} value={name?.[cur] ?? ""} onChange={(e) => onName({ ...name, [cur]: e.target.value })} /></label>
        {onDesc && <label className="fld"><span>Description</span><textarea lang={cur} rows={3} aria-label={`Description, ${short}`} value={desc?.[cur] ?? ""} onChange={(e) => onDesc({ ...desc, [cur]: e.target.value })} /></label>}
      </div>
    );
  }
  return (
    <>
      <div className="grp">
        <h3>Name</h3>
        {LANGS.map(([k, l]) => (
          <label className="lf" key={k}><span className={miss(k)}>{l}</span>
            <input lang={k} aria-label={`Name, ${l}`} value={name?.[k] ?? ""} onChange={(e) => onName({ ...name, [k]: e.target.value })} /></label>
        ))}
      </div>
      {onDesc && (
        <div className="grp">
          <h3>Description</h3>
          {LANGS.map(([k, l]) => (
            <label className="lf" key={k}><span>{l}</span>
              <textarea lang={k} rows={2} aria-label={`Description, ${l}`} value={desc?.[k] ?? ""} onChange={(e) => onDesc({ ...desc, [k]: e.target.value })} /></label>
          ))}
        </div>
      )}
    </>
  );
}

const FormHead = ({ what, name }: { what: string; name?: Tr }) => (
  <header className="form-head"><span>{what}</span><h2>{label(name)}</h2></header>
);

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Edits save as you type, so the panel has no Save or Done; only the small sidebar rename box keeps a Done to close it.
function FormFoot({ onDelete, what, onDone }: { onDelete: () => void; what: string; onDone?: () => void }) {
  return (
    <div className="form-foot">
      <button className="danger-link" onClick={onDelete}>Delete {what}</button>
      {onDone ? <button className="primary" onClick={onDone}>Done</button> : <span className="hint">Changes save automatically</span>}
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

function ItemForm({ token, item, compact, track, onDraft, fresh, onClose }: { token: string; item: Item; compact: boolean; track: Track; onDraft: OnDraft; fresh: boolean; onClose: () => void }) {
  const saveItem = useMutation(api.admin.saveItem).withOptimisticUpdate(optimistic("items"));
  const remove = useMutation(api.admin.remove);
  const uploadUrl = useMutation(api.admin.uploadUrl);
  const [d, change] = useDraft(strip(item), ({ photoUrl, ...data }) => (filled(data.name) ? track(saveItem({ token, id: item._id, data: clean(data) })) : undefined), onDraft);
  const [upErr, setUpErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [priceText, setPriceText] = useState(d.price?.toString() ?? "");
  const ref = useRef<HTMLDivElement>(null);
  useFresh(fresh, ref);

  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setUpErr("That file is not an image.");
    setBusy(true);
    setUpErr("");
    try {
      const blob = await shrink(file);
      const r = await fetch(await uploadUrl({ token }), { method: "POST", headers: { "Content-Type": "image/webp" }, body: blob });
      if (!r.ok) throw new Error();
      const { storageId } = await r.json();
      change({ photo: storageId, photoUrl: URL.createObjectURL(blob), crop: undefined, display: d.display === "none" ? undefined : d.display }, true);
      setCropping(d.display !== "original");
    } catch {
      setUpErr("The photo could not be uploaded. Try another file.");
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!(await ask({ title: `Delete “${label(d.name)}”?`, body: "The dish is removed from the menu. This cannot be undone.", yes: "Delete dish", danger: true }))) return;
    await track(remove({ token, id: item._id }));
    onClose();
  }

  return (
    <div className="ed-form" ref={ref}>
      <FormHead what={compact ? "Short-list dish" : "Dish"} name={d.name} />
      <Langs name={d.name} desc={d.description} onName={(name) => change({ name })} onDesc={compact ? undefined : (description) => change({ description })} />
      {!filled(d.name) && <p className="err" role="alert">Give it a name; until then nothing is saved.</p>}
      <div className="grp">
        <h3>Price</h3>
        <label className="price-field">
          <input inputMode="decimal" aria-label="Price" value={priceText}
            onChange={(e) => { setPriceText(e.target.value); const n = num(e.target.value); if (n === undefined || !Number.isNaN(n)) change({ price: n }); }} />
          <span>₾</span>
        </label>
        <div className="switches">
          <Toggle checked={!!d.soldOut} onChange={(soldOut) => change({ soldOut }, true)}>Sold out</Toggle>
          <Toggle checked={!!d.hidden} onChange={(hidden) => change({ hidden }, true)}>Hidden from guests</Toggle>
        </div>
      </div>
      {!compact && (
        <>
          <div className="grp" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}>
            <h3>Photo</h3>
            {d.photoUrl ? (
              <>
                <span className="preview crop" data-size={d.display ?? "small"} style={d.display === "original" ? undefined : cropVars(d.crop)}><img src={onScreen(d.photoUrl) ?? d.photoUrl} alt="" /></span>
                <div className="photo-btns">
                  {d.display === "original" ? <label className="secondary file">Replace photo<input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} /></label> : <button className="secondary" onClick={() => setCropping(true)}>Edit</button>}
                  {d.display === "original" && <button className="secondary" onClick={async () => { if (await ask({ title: "Remove this photo?", body: "The dish shows without a photo until you add one again.", yes: "Remove photo", danger: true })) change({ photo: undefined, photoUrl: null, crop: undefined }, true); }}>Remove photo</button>}
                </div>
                <div className="seg sizes" role="radiogroup" aria-label="Photo size on the menu">
                  {LAYOUTS.map(([k, l, icon]) => (
                    <button key={k} role="radio" aria-checked={(d.display ?? "small") === k} aria-pressed={(d.display ?? "small") === k} onClick={() => { change({ display: k }, true); setCropping(false); }}>{icon}{l}</button>
                  ))}
                </div>
                <p className="hint">{FRAMES[d.display ?? "small"]}</p>
                {cropping && <Cropper key={d.photoUrl} src={d.photoUrl} big={d.display === "big"} crop={d.crop} busy={busy} onReplace={upload}
                  onRemove={async () => { if (await ask({ title: "Remove this photo?", body: "The dish shows without a photo until you add one again.", yes: "Remove photo", danger: true })) { change({ photo: undefined, photoUrl: null, crop: undefined }, true); setCropping(false); } }}
                  onOriginal={() => { change({ display: "original" }, true); setCropping(false); }}
                  onCancel={() => setCropping(false)} onDone={(crop) => { change({ crop }, true); setCropping(false); }} />}
              </>
            ) : (
              <label className="drop file">
                <b>{busy ? "Uploading…" : "Add photo"}</b>
                {!busy && <span>or drop one here. Small shows it square (1:1), Small original keeps the whole picture, Big 4:3 landscape.</span>}
                <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
              </label>
            )}
            {upErr && <p className="err" role="alert">{upErr}</p>}
          </div>
          <div className="grp">
            <h3>Marks</h3>
            <div className="opts" role="group" aria-label="Marks">
              {TAGS.map(([k, l]) => <button key={k} className={`opt t-${k}`} aria-pressed={!!d.tags?.includes(k)} onClick={() => change({ tags: flip(d.tags, k) }, true)}>{l}</button>)}
            </div>
          </div>
        </>
      )}
      <FormFoot what="dish" onDelete={del} />
    </div>
  );
}

function CategoryForm({ token, cat, sizes, track, onDraft, fresh, onClose }: { token: string; cat: Doc<"categories">; sizes: Display[]; track: Track; onDraft: OnDraft; fresh: boolean; onClose: () => void }) {
  const save = useMutation(api.admin.saveCategory).withOptimisticUpdate(optimistic("categories"));
  const remove = useMutation(api.admin.remove);
  const setDisplay = useMutation(api.admin.setDisplay).withOptimisticUpdate((store, { token, categoryId, display }) => {
    const t = store.getQuery(api.admin.tree, { token });
    if (t) store.setQuery(api.admin.tree, { token }, { ...t, items: t.items.map((i) => (i.categoryId === categoryId ? { ...i, display } : i)) });
  });
  const [d, change] = useDraft(strip(cat), (data) => (filled(data.name) ? track(save({ token, id: cat._id, data: clean(data) })) : undefined), onDraft);
  const ref = useRef<HTMLDivElement>(null);
  useFresh(fresh, ref);
  const empty = !sizes.length;
  // pressed only when every dish already has that size
  const all = sizes.every((x) => x === sizes[0]) ? sizes[0] : undefined;
  async function del() {
    const body = empty ? "This cannot be undone." : `Its ${count(sizes.length, "dish", "dishes")} will be deleted with it. Only a published version (Versions) can bring them back.`;
    if (!(await ask({ title: `Delete the category “${label(d.name)}”?`, body, yes: "Delete category", danger: true }))) return;
    try { await track(remove({ token, id: cat._id })); onClose(); } catch {}
  }
  return (
    <div className="ed-form" ref={ref}>
      <FormHead what="Category" name={d.name} />
      <Langs name={d.name} onName={(name) => change({ name })} />
      <div className="switches">
        <Toggle checked={!!d.compact} onChange={(compact) => change({ compact }, true)}><span>Short list <small>name …… price, no photos (drinks, extras)</small></span></Toggle>
      </div>
      {!d.compact && !empty && (
        <div className="grp">
          <h3>Photo size for all {sizes.length} dishes</h3>
          <div className="seg sizes" role="radiogroup" aria-label="Photo size for every dish in this category">
            {LAYOUTS.map(([k, l, icon]) => (
              <button key={k} role="radio" aria-checked={all === k} aria-pressed={all === k} onClick={() => all !== k && track(setDisplay({ token, categoryId: cat._id, display: k }))}>{icon}{l}</button>
            ))}
          </div>
          <p className="hint">{all ? FRAMES[all] : "The dishes use different sizes now."}</p>
        </div>
      )}
      <FormFoot what="category" onDelete={del} />
    </div>
  );
}

function SectionForm({ token, sec, holds, track, onDraft, fresh, onClose }: { token: string; sec: Doc<"sections">; holds: string; track: Track; onDraft: OnDraft; fresh: boolean; onClose: () => void }) {
  const save = useMutation(api.admin.saveSection).withOptimisticUpdate(optimistic("sections"));
  const setAll = useMutation(api.admin.setTitleSize).withOptimisticUpdate((store, { token, titleSize }) => {
    const t = store.getQuery(api.admin.tree, { token });
    if (t) store.setQuery(api.admin.tree, { token }, { ...t, sections: t.sections.map((s) => ({ ...s, titleSize })) });
  });
  const remove = useMutation(api.admin.remove);
  const [d, change] = useDraft(strip(sec), (data) => (filled(data.name) ? track(save({ token, id: sec._id, data: clean(data) })) : undefined), onDraft);
  const ref = useRef<HTMLDivElement>(null);
  useFresh(fresh, ref);
  async function del() {
    const body = holds ? `Its ${holds} will be deleted with it. Only a published version (Versions) can bring them back.` : "This cannot be undone.";
    if (!(await ask({ title: `Delete the section “${label(d.name)}”?`, body, yes: "Delete section", danger: true }))) return;
    try { await track(remove({ token, id: sec._id })); onClose(); } catch {}
  }
  return (
    <div className="ed-form side-form-sec" ref={ref} onKeyDown={(e) => e.key === "Enter" && onClose()}>
      <Langs name={d.name} onName={(name) => change({ name })} tabs={false} />
      <div className="grp">
        <h3>Title size</h3>
        <div className="seg sizes" role="radiogroup" aria-label="Size of this section's title on the menu">
          {TITLE_SIZES.map(([k, l]) => (
            <button key={l} role="radio" aria-checked={d.titleSize === k} aria-pressed={d.titleSize === k} onClick={() => change({ titleSize: k }, true)}>{l}</button>
          ))}
        </div>
        <button className="side-all" onClick={() => track(setAll({ token, titleSize: d.titleSize }))}>Use this size for all sections</button>
      </div>
      <FormFoot what="section" onDelete={del} onDone={onClose} />
    </div>
  );
}

function CafeView({ token, settings, track }: { token: string; settings: Doc<"settings"> | null; track: Track }) {
  const save = useMutation(api.admin.saveSettings);
  const initial = useMemo(() => (settings ? strip(settings as Doc<"settings"> & { order?: number }) : {}), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, change] = useDraft(initial as Omit<Doc<"settings">, "_id" | "_creationTime">, (data) => track(save({ token, data: clean(data) })));
  const text = (k: "phone" | "mapUrl" | "instagram" | "opensAt" | "closesAt", l: string, ph = "") => (
    <div className="field">
      <label htmlFor={k}>{l}</label>
      <input id={k} placeholder={ph} value={d[k] ?? ""} onChange={(e) => change({ [k]: e.target.value })} />
    </div>
  );
  const tr = (k: "tagline" | "subline" | "address" | "hours" | "note", l: string) => (
    <fieldset className="field">
      <legend>{l}</legend>
      {LANGS.map(([lg, short]) => (
        <div className="lang-row" key={lg}>
          <span className={d[k]?.[lg]?.trim() ? "" : "missing"}>{short}</span>
          <input lang={lg} aria-label={`${l}, ${short}`} value={d[k]?.[lg] ?? ""} onChange={(e) => change({ [k]: { ...d[k], [lg]: e.target.value } })} />
        </div>
      ))}
    </fieldset>
  );
  return (
    <div className="cafe scroll">
      <section className="form">
        {tr("tagline", "Tagline under the logo")}
        {tr("subline", "Second line")}
        {tr("address", "Address")}
        {tr("hours", "Hours as guests read them")}
        <div className="grid3">
          {text("opensAt", "Opens at", "11:00")}
          {text("closesAt", "Closes at", "23:00")}
          {text("phone", "Phone", "+995 …")}
        </div>
        <div className="grid3">
          {text("mapUrl", "Google Maps link", "https://maps.app.goo.gl/…")}
          {text("instagram", "Instagram", "@suro")}
        </div>
        {tr("note", "Note at the bottom (allergies)")}
      </section>
    </div>
  );
}
