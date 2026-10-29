import { NextResponse, type NextRequest } from "next/server";

// "/" → Georgian, unless the guest picked another language before (owner: Georgian by default, not the phone's language).
export function proxy(req: NextRequest) {
  const saved = req.cookies.get("lang")?.value;
  const lang = saved === "en" || saved === "ru" ? saved : "ka";
  return NextResponse.redirect(new URL(`/${lang}`, req.url), 307);
}

export const config = { matcher: "/" };
