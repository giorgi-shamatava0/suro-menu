export default function StampGrid({
  threshold,
  stamps,
  rewardImageUrl,
}: {
  threshold: number;
  stamps: number;
  rewardImageUrl?: string | null;
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
            data-photo={gift && Boolean(rewardImageUrl)}
          >
            {gift && rewardImageUrl ? (
              <img className="stamp-reward-photo" src={rewardImageUrl} alt="" />
            ) : gift ? (
              <span className="stamp-gift-number">{threshold}</span>
            ) : i < stamps ? (
              <i className="stamp-impression" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
