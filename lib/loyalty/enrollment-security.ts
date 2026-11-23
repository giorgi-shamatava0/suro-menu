import { createHmac } from "node:crypto";
import { isIP } from "node:net";
export function enrollmentBucket(request: Request, admission: string) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  return createHmac("sha256", admission)
    .update(`signup-network:${ip && isIP(ip) ? ip : "local-or-unknown"}`)
    .digest("hex");
}
export function enrollmentPinDigest(pin: string, admission: string) {
  return createHmac("sha256", admission)
    .update(`signup-pin:${pin}`)
    .digest("hex");
}
