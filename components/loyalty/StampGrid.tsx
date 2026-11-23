import type { CSSProperties } from "react";

export default function StampGrid({
  threshold,
  stamps,
  animateStamp = null,
}: {
  threshold: number;
  stamps: number;
  animateStamp?: number | null;
}) {
  const columns =
    threshold <= 4 ? 4 : threshold <= 6 ? 3 : threshold <= 8 ? 4 : 5;
  const remainder = threshold % columns;
  return (
    <div
      className="card-preview-stamps"
      style={
        {
          "--stamp-columns": columns * 2,
          "--stamp-row-offset": columns - remainder + 1,
        } as CSSProperties
      }
      data-eight={threshold === 8}
      data-threshold={threshold}
      aria-hidden="true"
    >
      {Array.from({ length: Math.min(threshold, 20) }, (_, i) => {
        const gift = i === threshold - 1;
        return (
          <span
            key={i}
            data-filled={i < stamps}
            data-stamping={
              animateStamp !== null &&
              animateStamp > 0 &&
              i === animateStamp - 1
            }
            data-current={i === stamps}
            data-gift={gift}
            data-row-start={remainder > 0 && i === threshold - remainder}
          >
            {i < stamps ? (
              <i className="stamp-impression" />
            ) : gift ? (
              <svg
                className="stamp-gift-icon"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" />
                <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
              </svg>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
