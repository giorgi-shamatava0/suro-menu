import { dict, type Lang } from "@/lib/i18n";
import { getLocalMenu } from "@/lib/menu";
import Menu from "./Menu";

export async function renderMenu(lang: Lang) {
  const menu = await getLocalMenu(lang);
  const s = menu.settings;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: dict(lang).name,
    url: `https://suro-menu.vercel.app/${lang}`,
    telephone: s.phone,
    address: { "@type": "PostalAddress", streetAddress: s.address, addressLocality: "Tbilisi", addressCountry: "GE" },
    openingHours: s.opensAt && s.closesAt ? `Mo-Su ${s.opensAt}-${s.closesAt}` : undefined,
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: menu.sections.map((sec) => ({
        "@type": "MenuSection",
        name: sec.name,
        hasMenuItem: sec.cats.flatMap((c) =>
          c.items.map((i) => ({
            "@type": "MenuItem",
            name: i.name,
            description: i.desc || undefined,
            offers: i.price != null ? { "@type": "Offer", price: i.price, priceCurrency: "GEL" } : undefined,
          })),
        ),
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Menu lang={lang} t={dict(lang)} menu={menu} />
    </>
  );
}
