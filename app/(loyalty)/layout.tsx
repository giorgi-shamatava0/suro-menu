import type { Metadata } from "next";
import "./loyalty.css";
export const metadata: Metadata = {
  title: "Suro · Loyalty",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.ico" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body>
        <div className="loyalty-shell">{children}</div>
      </body>
    </html>
  );
}
