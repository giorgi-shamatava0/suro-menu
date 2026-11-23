import RewardCard from "./RewardCard";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function CardPreview({
  lang,
  threshold,
  reward,
}: {
  lang: CustomerLanguage;
  threshold: number;
  reward: string;
}) {
  const t = customerCopy[lang];
  return (
    <div
      className="customer-card-main"
      aria-label={t.preview}
    >
      <RewardCard
        lang={lang}
        title={t.cardHeading}
        name={reward}
        stamps={Math.min(2, threshold)}
        threshold={threshold}
        qr="/api/loyalty/signup-qr"
        scanLabel={t.preview}
      />
    </div>
  );
}
