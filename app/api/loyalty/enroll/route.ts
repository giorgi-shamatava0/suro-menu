import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { backend, COOKIE, sameOrigin } from "@/lib/loyalty/server";
import {
  enrollmentBucket,
  enrollmentPinDigest,
} from "@/lib/loyalty/enrollment-security";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 2048)
    return Response.json(
      { error: "Request too large" },
      { status: 413, headers },
    );
  const body = await request.json().catch(() => null);
  if (body?.consent !== "2026-11-23")
    return Response.json(
      { error: "Consent required" },
      { status: 400, headers },
    );
  if (
    body.pin !== undefined &&
    (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin))
  )
    return Response.json(
      { code: "STAFF_PIN_INVALID" },
      { status: 400, headers },
    );
  const admission = process.env.LOYALTY_ADMISSION_SECRET;
  if (!admission)
    return Response.json(
      { error: "Enrollment unavailable" },
      { status: 503, headers },
    );
  const jar = await cookies();
  const saved = jar.get(COOKIE)?.value;
  const secret =
    saved && /^[a-f0-9]{64}$/.test(saved)
      ? saved
      : randomBytes(32).toString("hex");
  const cookieOptions = {
    httpOnly: true,
    secure: new URL(request.headers.get("origin")!).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 5 * 365 * 86400,
  };
  // Keep retries tied to the same browser, including unsuccessful PIN attempts.
  jar.set(COOKIE, secret, cookieOptions);
  jar.delete("suro-signup-device");
  try {
    const result = await backend().mutation(api.loyalty.enroll, {
      admission,
      bucket: enrollmentBucket(request, admission),
      secret,
      qr: randomBytes(32).toString("hex"),
      ...(body.pin
        ? { pinDigest: enrollmentPinDigest(body.pin, admission) }
        : {}),
    });
    if (!result.ok) {
      const status =
        result.reason === "STAFF_PIN_REQUIRED"
          ? 409
          : result.reason === "STAFF_PIN_LOCKED"
            ? 429
            : result.reason === "STAFF_PIN_NOT_CONFIGURED"
              ? 503
              : 401;
      const retry = Math.max(
        1,
        Math.ceil((result.resetsAt - Date.now()) / 1000),
      );
      return Response.json(
        { code: result.reason, resetsAt: result.resetsAt },
        {
          status,
          headers:
            status === 429
              ? { ...headers, "Retry-After": String(retry) }
              : headers,
        },
      );
    }
    jar.set(COOKIE, result.secret, cookieOptions);
    return Response.json({ ok: true, code: result.code }, { headers });
  } catch (error) {
    const message =
      error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "";
    if (
      [
        "Enrollment is not configured",
        "No active loyalty program",
        "Program does not support welcome stamps",
      ].includes(message)
    )
      return Response.json(
        { error: "Enrollment unavailable" },
        { status: 503, headers },
      );
    console.error("Loyalty enrollment failed", {
      kind: error instanceof ConvexError ? "application" : "backend",
    });
    return Response.json(
      { error: "Unable to create your card" },
      { status: 500, headers },
    );
  }
}
