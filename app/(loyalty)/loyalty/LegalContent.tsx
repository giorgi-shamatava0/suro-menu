import { legalText } from "@/lib/loyalty/legal-notice";
import { customerCopy, type CustomerLanguage } from "@/lib/loyalty/customer-copy";
export default function LegalContent({
  lang,
  terms,
}: {
  lang: CustomerLanguage;
  terms?: string;
}) {
  return (
    <article className="legal-content" lang={lang}>
      <h1>{customerCopy[lang].terms}</h1>
      <p style={{whiteSpace:"pre-wrap"}}>{legalText(lang, terms)}</p>
    </article>
  );
}
