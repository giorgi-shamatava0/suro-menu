import type { CSSProperties } from "react";
import Image from "next/image";
import type { UiKey } from "@/lib/i18n";
import type { MenuItem } from "@/lib/menu";

type T = Record<UiKey, string>;
export type Crop = NonNullable<MenuItem["crop"]>;
// feeds .crop in site.css
export const cropVars = (c?: Crop) => (c ? ({ "--x": `${c.x}%`, "--y": `${c.y}%`, "--z": c.z } as CSSProperties) : undefined);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function Price({ it }: { it: MenuItem }) {
  return it.price == null ? null : <span className="price">{fmt(it.price)}<small>₾</small></span>;
}

export const Icon = {
  leaf: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13c0-6 4-10 10-10 0 6-4 10-10 10Zm0 0 6-6" /></svg>,
  chili: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 4c-1 5-4 8-8 9 5 1 10-2 10-7 0-1-1-2-2-2Zm0 0c0-1 1-2 2-2" /></svg>,
  star: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12M4 4l8 8M12 4l-8 8" /></svg>,
  dot: <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" /></svg>,
  search: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>,
  arrow: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>,
};
export const tagIcon = (k: string) => (k === "vegan" || k === "vegetarian" ? Icon.leaf : k === "spicy" ? Icon.chili : k === "signature" ? Icon.star : Icon.dot);

// A zoomed-in picture needs that many more pixels to stay sharp.
export const zoomSizes = (px: number, vw: number, z = 1) => (vw ? `(min-width: 700px) ${Math.round(px * z)}px, ${Math.round(vw * z)}vw` : `${Math.round(px * z)}px`);

function Tags({ it, t }: { it: MenuItem; t: T }) {
  if (!it.tags.length) return null;
  return (
    <span className="tags">
      {it.tags.map((k) => (
        <span key={k} className={`tag tag-${k}`}>{tagIcon(k)}{t[`tag.${k}` as UiKey] ?? k}</span>
      ))}
    </span>
  );
}

// One dish as guests see it; the admin canvas draws the same row. onOpen makes a dish with a photo clickable.
export function Row({ it, compact, t, onOpen }: { it: MenuItem; compact: boolean; t: T; onOpen?: () => void }) {
  const photo = !compact && it.photo;
  const Tag = photo && onOpen ? "button" : "div";
  return (
    <Tag {...(Tag === "button" && { type: "button" as const, onClick: onOpen })} className={`item${photo ? " has-photo" : ""}${photo && it.big ? " big" : ""}${it.soldOut ? " is-sold" : ""}${it.hidden ? " is-hidden" : ""}`}>
      {photo && (
        <span className="photo crop" style={cropVars(it.crop)}>
          <Image src={photo} alt="" width={it.big ? 1200 : 480} height={it.big ? 900 : 480} loading="lazy"
            sizes={zoomSizes(it.big ? 640 : 160, it.big ? 92 : 0, it.crop?.z)} />
        </span>
      )}
      <span className="text">
        <span className="head">
          <span className="name">{it.name}{it.hidden && <span className="hidden-mark">Hidden</span>}</span>
          {compact && <span className="leader" aria-hidden="true" />}
          {it.soldOut ? <span className="sold">{t.soldOut}</span> : <Price it={it} />}
        </span>
        {it.desc && !compact && <span className="desc">{it.desc}</span>}
        {!compact && <Tags it={it} t={t} />}
      </span>
    </Tag>
  );
}
