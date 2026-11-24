"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { cropVars, type Crop } from "@/app/(site)/[lang]/Row";

type Box = { l: number; t: number; w: number }; // crop box on the original, as fractions of its width/height
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// The site draws a crop as object-fit: cover + object-position x/y + scale z around that same point (site.css .crop).
// For a frame of ratio a on a photo of ratio r that shows the box: width fw / z, left edge at x% of (1 - width).
export function boxToCrop({ l, t, w }: Box, r: number, a: number): Crop {
  const fw = Math.min(1, a / r), h = (w * r) / a;
  const at = (pos: number, size: number) => (size < 0.999 ? +clamp((pos / (1 - size)) * 100, 0, 100).toFixed(1) : 50);
  return { x: at(l, w), y: at(t, h), z: +clamp(fw / w, 1, 3).toFixed(2) };
}
export function cropToBox(c: Crop | undefined, r: number, a: number): Box {
  const { x, y, z } = c ?? { x: 50, y: 50, z: 1 };
  const w = Math.min(1, a / r) / z, h = (w * r) / a;
  return { l: (x / 100) * (1 - w), t: (y / 100) * (1 - h), w };
}

// The copy of this photo the page already shows (the dish's list row), so nothing downloads again.
// Picks the biggest one that has finished loading; undefined if none.
export function onScreen(src: string) {
  const enc = encodeURIComponent(src);
  let best: HTMLImageElement | undefined;
  for (const i of document.images)
    if (i.complete && i.naturalWidth && (i.currentSrc === src || i.currentSrc.includes(enc)) && (!best || i.naturalWidth > best.naturalWidth)) best = i;
  return best?.currentSrc;
}

// Edit a dish photo: the whole original with the frame guests see drawn on it (3×3 grid). Drag the frame to move it,
// pull a corner to resize. The original is kept; only the frame's position and size are saved.
export default function Cropper({ src, big, crop, busy, onReplace, onRemove, onOriginal, onDone, onCancel }: {
  src: string; big: boolean; crop?: Crop; busy: boolean;
  onOriginal: () => void; onReplace: (f?: File) => void; onRemove: () => void; onDone: (c: Crop) => void; onCancel: () => void;
}) {
  const a = big ? 4 / 3 : 1;
  const [r, setR] = useState(0); // photo width / height, known once it loads
  const [box, setBox] = useState<Box | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "move" | [number, number]; x: number; y: number; b: Box } | null>(null);
  useEffect(() => { dlg.current?.showModal(); }, []);
  // open at once with the copy already on screen; swap in the full photo when it is in (same shape, the frame stays)
  const [shown, setShown] = useState(() => onScreen(src) ?? src);
  useEffect(() => {
    if (shown === src) return;
    const i = new Image();
    i.onload = () => setShown(src);
    i.src = src;
    return () => { i.onload = null; };
  }, [shown, src]);

  const touched = useRef(false);
  function init(i: HTMLImageElement) {
    if (r) return; // the full photo replacing the screen copy: keep the frame where it is
    const q = i.naturalWidth / i.naturalHeight;
    setR(q);
    // No crop yet: a full-size frame often can't move at all (square photo, square frame), so start a bit smaller
    // and centred to make it draggable right away. Done without touching it keeps the menu as it was.
    setBox(cropToBox(crop ?? { x: 50, y: 50, z: 1.25 }, q, a));
  }
  const h = (b: Box) => (b.w * r) / a; // box height as a fraction of the photo height
  const wMax = Math.min(1, a / r), wMin = wMax / 3; // zoom 1–3, as before

  function down(e: PointerEvent, kind: "move" | [number, number]) {
    if (!box) return;
    touched.current = true;
    e.stopPropagation();
    stage.current!.setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, b: box };
  }
  function move(e: PointerEvent) {
    const g = drag.current;
    if (!g) return;
    const s = stage.current!.getBoundingClientRect();
    const b = g.b, bh = h(b);
    if (g.kind === "move") {
      setBox({ ...b, l: clamp(b.l + (e.clientX - g.x) / s.width, 0, 1 - b.w), t: clamp(b.t + (e.clientY - g.y) / s.height, 0, 1 - bh) });
      return;
    }
    // resize from a corner; the opposite corner stays put
    const [sx, sy] = g.kind;
    const ax = sx > 0 ? b.l : b.l + b.w, ay = sy > 0 ? b.t : b.t + bh;
    const px = (e.clientX - s.left) / s.width, py = (e.clientY - s.top) / s.height;
    const room = Math.min(sx > 0 ? 1 - ax : ax, ((sy > 0 ? 1 - ay : ay) * a) / r);
    const w = clamp(Math.max(Math.abs(px - ax), (Math.abs(py - ay) * a) / r), wMin, Math.min(wMax, room));
    setBox({ w, l: sx > 0 ? ax : ax - w, t: sy > 0 ? ay : ay - (w * r) / a });
  }
  function key(e: KeyboardEvent) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step || !box) return;
    touched.current = true;
    e.preventDefault();
    setBox({ ...box, l: clamp(box.l + step[0] * 0.02, 0, 1 - box.w), t: clamp(box.t + step[1] * 0.02, 0, 1 - h(box)) });
  }

  const out = box && r ? boxToCrop(box, r, a) : crop;
  const pct = (n: number) => `${n * 100}%`;
  return (
    <dialog ref={dlg} className="dlg cropper" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2>Edit photo</h2>
      <div className="ce-body">
        <div className="ce-stage" ref={stage} data-ready={!!box} aria-busy={!box} style={r ? ({ "--ratio": r } as CSSProperties) : undefined} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          {/* ref too: a cached photo can finish loading before onLoad is attached */}
          <img src={shown} alt="" draggable={false} ref={(i) => { if (i?.complete && i.naturalWidth && !r) init(i); }} onLoad={(e) => init(e.currentTarget)} />
          {!box && <span className="ce-wait">Loading photo…</span>}
          {box && (
            <div className="ce-box" style={{ left: pct(box.l), top: pct(box.t), width: pct(box.w), height: pct(h(box)) }}
              tabIndex={0} role="application" aria-label="Photo frame. Drag it, pull a corner to resize, or use the arrow keys."
              onPointerDown={(e) => down(e, "move")} onKeyDown={key}>
              {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => (
                // the handle at corner (sx, sy) grows the box towards that corner
                <span key={`${sx}${sy}`} className="ce-h" data-x={sx} data-y={sy} onPointerDown={(e) => down(e, [sx, sy])} />
              ))}
            </div>
          )}
        </div>
        <div className="ce-side">
          <span className="ce-prev crop" data-size={big ? "big" : "small"} style={cropVars(out)}><img src={shown} alt="" /></span>
          <small>On the menu</small>
        </div>
      </div>
      {box && (
        <p className="ce-hint">
          {box.w > wMax - 0.001 && h(box) > 0.999
            ? "The frame shows the whole photo. Pull a corner inward to zoom in, then drag the frame."
            : "Drag the frame to choose what shows. Pull a corner to zoom in or out."}
        </p>
      )}
      <div className="ask-btns ce-btns">
        <label className="secondary file">
          {busy ? "Uploading…" : "Replace"}
          <input type="file" accept="image/*" onChange={(e) => onReplace(e.target.files?.[0])} disabled={busy} />
        </label>
        <button className="ghost" onClick={onRemove}>Remove</button>
        <span className="ce-gap" />
        {!big && <button className="secondary" disabled={busy} onClick={onOriginal}>Use original</button>}
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!out} onClick={() => (touched.current && out ? onDone(out) : onCancel())}>Done</button>
      </div>
    </dialog>
  );
}
