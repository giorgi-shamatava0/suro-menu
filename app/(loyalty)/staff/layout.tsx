import { Inter, Noto_Sans_Georgian } from "next/font/google";
import "./staff.css";
const ui = Inter({ subsets: ["latin", "cyrillic"], variable: "--f-staff-ui" });
const ka = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--f-staff-ka",
});
export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`scanner-shell ${ui.variable} ${ka.variable}`}>
      {children}
    </div>
  );
}
