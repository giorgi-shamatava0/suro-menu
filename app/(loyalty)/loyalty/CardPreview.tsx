import Image from "next/image";
import StampGrid from "@/components/loyalty/StampGrid";
import { plates } from "@/lib/decor";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export default function CardPreview({ lang }: { lang: CustomerLanguage }) {
  const t = customerCopy[lang];
  return (
    <figure className="card-preview" aria-label={t.preview}>
      <Image
        className="card-preview-leaf"
        src={plates["monstera-b"]}
        alt=""
        sizes="200px"
        priority
      />
      <div className="card-preview-top">
        <span className="loyalty-mark" aria-hidden="true" />
        <span className="card-preview-label">{t.preview}</span>
      </div>
      <figcaption>{t.card}</figcaption>
      <StampGrid threshold={8} stamps={2} />
      <div className="card-preview-bottom">
        <span>{t.stamps}</span>
        <span>
          2 <span className="card-preview-divider">/</span> 8
        </span>
      </div>
    </figure>
  );
}
