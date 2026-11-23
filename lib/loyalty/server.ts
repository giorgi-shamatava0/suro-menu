import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { cookies } from "next/headers";
export const COOKIE = "suro-loyalty";
export function backend() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Loyalty backend is not configured");
  return new ConvexHttpClient(url);
}
export async function currentCard(secret?: string) {
  const value = secret ?? (await cookies()).get(COOKIE)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return backend().query(api.loyalty.card, { secret: value });
}
export { sameOrigin } from "./origin";
