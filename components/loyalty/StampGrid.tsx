export default function StampGrid({
  threshold,
  stamps,
}: {
  threshold: number;
  stamps: number;
}) {
  return (
    <div
      className="card-preview-stamps"
      data-eight={threshold === 8}
      aria-hidden="true"
    >
      {Array.from({ length: Math.min(threshold, 20) }, (_, i) => {
        const gift = i === threshold - 1;
        return (
          <span
            key={i}
            data-filled={i < stamps}
            data-current={i === stamps}
            data-gift={gift}
          >
            {gift ? (
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" />
                <path d="M12 7C5 7 5 1 9 3c2 1 3 4 3 4Zm0 0c7 0 7-6 3-4-2 1-3 4-3 4Z" />
              </svg>
            ) : i < stamps ? (
              <i className="stamp-impression" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
