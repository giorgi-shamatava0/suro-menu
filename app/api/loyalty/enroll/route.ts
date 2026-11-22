import { randomBytes, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { api } from "@/convex/_generated/api";
import { backend, COOKIE, sameOrigin } from "@/lib/loyalty/server";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const admission = process.env.LOYALTY_ADMISSION_SECRET;
  const jar = await cookies();
  const secret = jar.get(COOKIE)?.value ?? randomBytes(32).toString("hex");
  // Vercel overwrites this header. Other hosts must configure an equivalent trusted proxy.
  const ip = process.env.VERCEL
    ? (request.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
  const bucket = admission
    ? createHmac("sha256", admission).update(ip).digest("hex")
    : "";
  try {
    const qr = randomBytes(32).toString("hex");
    const result = admission
      ? await backend().mutation(api.loyalty.enroll, {
          admission,
          bucket,
          secret,
          qr,
        })
      : await backend().action(api.loyalty.enrollPublic, { secret, qr });
    jar.set(COOKIE, result.secret, {
      httpOnly: true,
      // The checked browser origin may be HTTP for a phone testing on local Wi-Fi.
      secure: new URL(request.headers.get("origin")!).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 365 * 86400,
    });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Unable to create your card. Please try again later or ask the café team.",
      },
      { status: 429 },
    );
  }
}
