import Image from "next/image";
import { plates } from "@/lib/decor";
import type { UiKey } from "@/lib/i18n";
import type { LocalMenu } from "@/lib/menu";

type Props = { t: Record<UiKey, string>; s: LocalMenu["settings"] };

const pin = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const phone = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5 9 4l1.2 4-2 1.3a12 12 0 0 0 6.5 6.5l1.3-2 4 1.2.5 2.4c-.2 1.5-1.6 2.6-3.1 2.6C9.6 20 4 14.4 4 6.6 4 5.1 5.1 3.7 6.6 3.5Z" /></svg>;
const clock = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const up = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>;

// The page's close, a mirror of the hero: plants rise from the bottom corners around the name and where to find Suro.
export default function Footer({ t, s }: Props) {
  const tel = s.phone && `tel:${s.phone.replace(/[^+\d]/g, "")}`;
  const where = s.address && (s.mapUrl ? <a href={s.mapUrl} target="_blank" rel="noopener">{s.address}</a> : s.address);
  const note = s.note && <p className="foot-note">{s.note}</p>;
  const top = <a className="foot-top" href="#top">{up}{t.top}</a>;
  const logo = <span className="logo foot-logo" role="img" aria-label={t.name} />;

  return (
    <footer className="visit">
      <div className="foot-inner">
        {logo}
        <h2>{t.visit}</h2>
        <ul className="foot-lines">
          {where && <li>{pin}{where}</li>}
          {s.hours && <li>{clock}{s.hours}</li>}
          {tel && <li>{phone}<a href={tel}>{s.phone}</a></li>}
        </ul>
        {note}
        {top}
      </div>
      <Image className="deco foot-left" src={plates["fern-frond"]} alt="" sizes="70vw" />
      <Image className="deco foot-right" src={plates["monstera-b"]} alt="" sizes="70vw" />
    </footer>
  );
}
