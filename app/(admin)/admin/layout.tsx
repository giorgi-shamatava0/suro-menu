import type { Metadata } from "next";
import { Inter, Noto_Sans_Georgian, Noto_Serif_Georgian, Spectral } from "next/font/google";
import "../../(site)/[lang]/site.css";
import "./admin.css";

// The editor's own text is sans; the menu canvas uses the guest site's serif fonts and styles.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--f-ui" });
const georgian = Noto_Sans_Georgian({ subsets: ["georgian"], variable: "--f-ui-ka" });
const spectral = Spectral({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "800"], style: ["normal", "italic"], variable: "--f-lat" });
const serifKa = Noto_Serif_Georgian({ subsets: ["georgian"], weight: ["400", "500", "800"], variable: "--f-ka" });

export const metadata: Metadata = { title: "Suro · Menu editor", robots: { index: false, follow: false }, icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png" }], apple: "/apple-icon.png" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${georgian.variable} ${spectral.variable} ${serifKa.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
