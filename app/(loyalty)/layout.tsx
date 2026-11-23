import { Noto_Serif_Georgian, Spectral } from "next/font/google";
import type { Metadata } from "next";
import "./loyalty.css";
const spectral = Spectral({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "800"],
  style: ["normal", "italic"],
  variable: "--f-lat",
});
const georgian = Noto_Serif_Georgian({
  subsets: ["georgian"],
  weight: ["400", "500", "800"],
  variable: "--f-ka",
});
export const metadata: Metadata = {
  title: "Suro · Loyalty",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.ico" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={`${spectral.variable} ${georgian.variable}`}>
      <body>
        <div className="loyalty-shell">{children}</div>
      </body>
    </html>
  );
}
