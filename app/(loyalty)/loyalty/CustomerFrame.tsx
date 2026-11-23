"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { hero, plates } from "@/lib/decor";

const scenery = [
  { src: hero.canopy, className: "customer-canopy", sizes: "160vw" },
  { src: hero.basket, className: "customer-basket", sizes: "(min-width: 900px) 300px, 190px" },
  { src: hero.bulbs, className: "customer-bulbs", sizes: "(min-width: 900px) 180px, 120px" },
  { src: plates["fern-frond"], className: "customer-leaf-left", sizes: "(min-width: 900px) 420px, 310px" },
  { src: hero.monstera, className: "customer-leaf-right", sizes: "(min-width: 900px) 440px, 300px" },
];
const curtain: { src: StaticImageData; className: string }[] = [
  { src: hero.canopy, className: "c-top" },
  { src: hero.vine, className: "c-bottom" },
  { src: plates["pothos-cascade"], className: "c-tr" },
  { src: hero.leaves, className: "c-scatter" },
  { src: plates["fern-frond"], className: "c-bl" },
  { src: plates["monstera-a"], className: "c-left" },
  { src: hero.monstera, className: "c-right" },
];

export default function CustomerFrame({ children }: { children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  preload("/decor/bg/stone-night.webp", { as: "image" });
  preload("/logo-mask.png", { as: "image", fetchPriority: "high" });

  useEffect(() => {
    let cancelled = false;
    let revealed = false;
    const images = Array.from(frame.current?.querySelectorAll("img") ?? []);
    const texture = new window.Image();
    texture.src = "/decor/bg/stone-night.webp";
    // Decode in parallel, including cached images, before parting the curtain.
    const decoded = [...images, texture].map(async (img) => {
      try {
        await img.decode();
        if (!cancelled && !revealed) img.dataset.decoded = "true";
      } catch { /* A missing decoration must not prevent the page opening. */ }
    });
    const reveal = () => {
      if (!cancelled && !revealed) {
        revealed = true;
        setReady(true);
      }
    };
    const timeout = window.setTimeout(reveal, 3500);
    Promise.allSettled(decoded).then(reveal);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, []);

  return (
    <div ref={frame} className={`customer-page${ready ? " customer-ready" : ""}`}>
      <div className="customer-scenery" aria-hidden="true">
        {scenery.map(({ src, className, sizes }) => (
          <Image key={className} className={className} src={src} sizes={sizes} alt="" loading="eager" />
        ))}
      </div>
      {!finished && (
        <div className="customer-intro" aria-hidden="true" onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setFinished(true);
        }}>
          {curtain.map(({ src, className }) => (
            <Image key={className} className={className} src={src} alt="" loading="eager"
              sizes={className === "c-top" || className === "c-bottom" ? "160vw" : "(min-width: 900px) 640px, 75vw"} />
          ))}
        </div>
      )}
      <noscript><style>{".customer-intro{display:none}.customer-page .customer-scenery{visibility:visible}.customer-page .customer-scenery img{visibility:visible}"}</style></noscript>
      {children}
    </div>
  );
}
