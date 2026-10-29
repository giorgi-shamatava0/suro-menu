import type { Metadata, Viewport } from "next";
import { Noto_Serif_Georgian, Spectral } from "next/font/google";
import { notFound } from "next/navigation";
import { LANGS, dict, type Lang } from "@/lib/i18n";
import "./site.css";
import "./hero.css";

const spectral = Spectral({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "800"], style: ["normal", "italic"], variable: "--f-lat" });
const georgian = Noto_Serif_Georgian({ subsets: ["georgian"], weight: ["400", "500", "800"], variable: "--f-ka" });

export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export const viewport: Viewport = { themeColor: "#0f1311", viewportFit: "cover", colorScheme: "dark" };

const desc = {
  ka: "სურო — კაფე-ბაღი თბილისში. მენიუ: კერძები, სასმელები, ტკბილეული.",
  en: "Suro — a garden café in Tbilisi. Menu: food, drinks and sweets.",
  ru: "Суро — кафе-сад в Тбилиси. Меню: блюда, напитки, сладкое.",
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  return {
    metadataBase: new URL("https://suro-menu.vercel.app"),
    title: `${t.name} · ${t.menu}`,
    description: desc[lang],
    alternates: { canonical: `/${lang}`, languages: { ka: "/ka", en: "/en", ru: "/ru", "x-default": "/ka" } },
    openGraph: { title: `${t.name} · ${t.menu}`, description: desc[lang], images: "/og.jpg", locale: lang, type: "website" },
    icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png" }], apple: "/apple-icon.png" },
  };
}

export default async function Layout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  return (
    <html lang={lang} className={`${spectral.variable} ${georgian.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
