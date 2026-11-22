import { NextResponse, type NextRequest } from "next/server";

// "/" → Georgian, unless the guest picked another language before (owner: Georgian by default, not the phone's language).
export function proxy(req: NextRequest) {
  const saved = req.cookies.get("lang")?.value;
  const lang = saved === "en" || saved === "ru" ? saved : "ka";
  const response = NextResponse.redirect(new URL(`/${lang}`, req.url), 307);
  // This redirect belongs to one visitor, never to a shared CDN/browser cache.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export const config = { matcher: "/" };
