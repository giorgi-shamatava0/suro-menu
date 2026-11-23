import StampGrid from "@/components/loyalty/StampGrid";
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
    <figure className="loyalty-card live-stamp-card" aria-label={t.preview}>
      <div className="stamp-card-brand">
        <span className="stamp-card-title">{t.cardHeading}</span>
        <p className="stamp-card-total">
          2<span className="stamp-card-total-slash">/</span>
          <span className="stamp-card-total-limit">{threshold}</span>
        </p>
      </div>
      <div className="live-card-program">
        <StampGrid threshold={threshold} stamps={2} />
      </div>
      <footer className="stamp-card-footer">
        <div className="stamp-card-footer-copy">
          <p className="stamp-card-reward">{reward}</p>
          <small>{t.preview}</small>
        </div>
        <img
          className="loyalty-qr"
          src="/api/loyalty/signup-qr"
          alt={t.preview}
          width={88}
          height={88}
        />
      </footer>
    </figure>
  );
}
