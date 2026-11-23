import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { enrollmentPinDigest } from "../lib/loyalty/enrollment-security";
const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/loyalty.ts": () => import("../convex/loyalty"),
  "../convex/auth.ts": () => import("../convex/auth"),
};
const admission = "signup-pin-tests-only";
const pin = "012345";
const digest = enrollmentPinDigest(pin, admission);
const HOUR = 3600_000;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.LOYALTY_ADMISSION_SECRET;
});
async function setup() {
  process.env.LOYALTY_ADMISSION_SECRET = admission;
  const t = convexTest(schema, modules);
  const token = "admin-pin-test";
  await t.run(async (ctx) => {
    await ctx.db.insert("sessions", {
      token,
      expiresAt: Date.now() + HOUR * 24,
    });
    const programId = await ctx.db.insert("loyaltyPrograms", {
      name: "Test",
      description: "",
      products: "Coffee",
      reward: "Coffee",
      status: "active",
      version: 1,
    });
    await ctx.db.insert("loyaltyVersions", {
      programId,
      version: 1,
      threshold: 8,
      expiry: "never",
      months: 6,
      reward: "Coffee",
    });
  });
  const args = (n: number, pinDigest?: string) => ({
    admission,
    bucket: "cafe-wifi",
    secret: n.toString(16).padStart(64, "0"),
    qr: (n + 1000).toString(16).padStart(64, "0"),
    ...(pinDigest ? { pinDigest } : {}),
  });
  async function atLimit(count = 50) {
    await t.run((ctx) =>
      ctx.db.insert("loyaltyLimits", {
        key: "signup:hourly",
        count,
        until: (Math.floor(Date.now() / HOUR) + 1) * HOUR,
      }),
    );
  }
  return { t, token, args, atLimit };
}
test("first 50 cards are free; PIN approves one additional card without unlocking others", async () => {
  const { t, token, args } = await setup();
  await t.action(api.loyalty.setSignupPin, { token, pin });
  for (let n = 1; n <= 50; n++)
    expect((await t.mutation(api.loyalty.enroll, args(n))).ok).toBe(true);
  expect(await t.mutation(api.loyalty.enroll, args(51))).toMatchObject({
    ok: false,
    reason: "STAFF_PIN_REQUIRED",
  });
  expect((await t.mutation(api.loyalty.enroll, args(51, digest))).ok).toBe(
    true,
  );
  expect(await t.mutation(api.loyalty.enroll, args(52))).toMatchObject({
    ok: false,
    reason: "STAFF_PIN_REQUIRED",
  });
  const count = await t.run((ctx) => ctx.db.query("loyaltyMembers").collect());
  expect(count).toHaveLength(51);
});
test("hourly count is shared across networks and resets exactly at the next hour", async () => {
  let now = Date.UTC(2026, 10, 23, 8, 59);
  vi.useFakeTimers({ now });
  const { t, args, atLimit } = await setup();
  await atLimit();
  expect(
    await t.mutation(api.loyalty.enroll, {
      ...args(1),
      bucket: "other-network",
    }),
  ).toMatchObject({
    ok: false,
    reason: "STAFF_PIN_REQUIRED",
    resetsAt: Date.UTC(2026, 10, 23, 9),
  });
  now = Date.UTC(2026, 10, 23, 9);
  vi.setSystemTime(now);
  expect((await t.mutation(api.loyalty.enroll, args(1))).ok).toBe(true);
  const row = await t.run((ctx) =>
    ctx.db
      .query("loyaltyLimits")
      .withIndex("by_key", (q) => q.eq("key", "signup:hourly"))
      .unique(),
  );
  expect(row?.count).toBe(1);
  expect(row?.until).toBe(Date.UTC(2026, 10, 23, 10));
});
test("parallel signups cannot exceed the free allowance, and retries reuse the card", async () => {
  const { t, args, atLimit } = await setup();
  await atLimit(49);
  const results = await Promise.all(
    [1, 2, 3, 4].map((n) => t.mutation(api.loyalty.enroll, args(n))),
  );
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  const winner = results.findIndex((r) => r.ok) + 1;
  expect(await t.mutation(api.loyalty.enroll, args(winner))).toEqual(
    results[winner - 1],
  );
  expect(
    await t.run((ctx) => ctx.db.query("loyaltyMembers").collect()),
  ).toHaveLength(1);
});
test("wrong PIN attempts persist, create no cards and lock the browser for one hour on the fourth wrong attempt", async () => {
  let now = Date.UTC(2026, 10, 23, 8, 5);
  vi.useFakeTimers({ now });
  const { t, token, args, atLimit } = await setup();
  await t.action(api.loyalty.setSignupPin, { token, pin });
  await atLimit();
  const bad = enrollmentPinDigest("999999", admission);
  for (let n = 0; n < 3; n++)
    expect(await t.mutation(api.loyalty.enroll, args(1, bad))).toMatchObject({
      ok: false,
      reason: "STAFF_PIN_INVALID",
    });
  const fourth = await t.mutation(api.loyalty.enroll, args(1, bad));
  expect(fourth).toMatchObject({ ok: false, reason: "STAFF_PIN_LOCKED" });
  expect(fourth.resetsAt).toBeGreaterThanOrEqual(now + HOUR);
  expect(await t.mutation(api.loyalty.enroll, args(1, digest))).toMatchObject({
    ok: false,
    reason: "STAFF_PIN_LOCKED",
  });
  expect(
    await t.run((ctx) => ctx.db.query("loyaltyMembers").collect()),
  ).toHaveLength(0);
  now += HOUR + 1000;
  vi.setSystemTime(now);
  expect((await t.mutation(api.loyalty.enroll, args(1, digest))).ok).toBe(true);
});
test("rotating browser identities cannot bypass the network PIN attempt limit", async () => {
  const { t, token, args, atLimit } = await setup();
  await t.action(api.loyalty.setSignupPin, { token, pin });
  await atLimit();
  const bad = enrollmentPinDigest("999999", admission);
  for (let n = 1; n < 30; n++)
    expect(await t.mutation(api.loyalty.enroll, args(n, bad))).toMatchObject({
      reason: "STAFF_PIN_INVALID",
    });
  expect(await t.mutation(api.loyalty.enroll, args(30, bad))).toMatchObject({
    reason: "STAFF_PIN_LOCKED",
  });
  expect(await t.mutation(api.loyalty.enroll, args(31, digest))).toMatchObject({
    reason: "STAFF_PIN_LOCKED",
  });
});
test("PIN setup requires admin, stores only a keyed digest and never exposes it in dashboard or cards", async () => {
  const { t, token, args, atLimit } = await setup();
  await expect(
    t.action(api.loyalty.setSignupPin, { token: "bad", pin }),
  ).rejects.toThrow();
  await expect(
    t.action(api.loyalty.setSignupPin, { token, pin: "1234" }),
  ).rejects.toThrow("six-digit");
  await t.action(api.loyalty.setSignupPin, { token, pin });
  const settings = await t.run((ctx) =>
    ctx.db.query("loyaltySignupSettings").first(),
  );
  expect(settings?.pinDigest).toBe(digest);
  expect(digest).toBe(
    createHmac("sha256", admission).update(`signup-pin:${pin}`).digest("hex"),
  );
  const dashboard = await t.query(api.loyalty.dashboard, { token });
  expect(dashboard.signupProtection.pinConfigured).toBe(true);
  expect(JSON.stringify(dashboard)).not.toContain(digest);
  await atLimit();
  const result = await t.mutation(api.loyalty.enroll, args(1, digest));
  if (!result.ok) throw new Error("Enrollment failed");
  const card = await t.query(api.loyalty.publicCard, { code: result.code });
  expect(JSON.stringify(card)).not.toContain(digest);
  const member = await t.run((ctx) => ctx.db.query("loyaltyMembers").first());
  expect(member?.createdAt).toBe(member?.consentedAt);
  const audit = await t.run((ctx) => ctx.db.query("loyaltyAudit").collect());
  expect(audit.find((e) => e.event === "member.created")?.at).toBe(
    member?.createdAt,
  );
});
test("PIN changes invalidate the old PIN; an unset PIN cannot bypass protection", async () => {
  const { t, token, args, atLimit } = await setup();
  await atLimit();
  expect(await t.mutation(api.loyalty.enroll, args(1, digest))).toMatchObject({
    reason: "STAFF_PIN_NOT_CONFIGURED",
  });
  await t.action(api.loyalty.setSignupPin, { token, pin });
  await t.action(api.loyalty.setSignupPin, { token, pin: "654321" });
  expect(await t.mutation(api.loyalty.enroll, args(1, digest))).toMatchObject({
    reason: "STAFF_PIN_INVALID",
  });
  expect(
    (
      await t.mutation(
        api.loyalty.enroll,
        args(1, enrollmentPinDigest("654321", admission)),
      )
    ).ok,
  ).toBe(true);
});

test("fourth-attempt lock lasts a full hour from that attempt, including across the hourly signup reset", async () => {
  let now = Date.UTC(2026, 10, 23, 8, 15);
  vi.useFakeTimers({ now });
  const { t, token, args, atLimit } = await setup();
  await t.action(api.loyalty.setSignupPin, { token, pin });
  await atLimit();
  const bad = enrollmentPinDigest("999999", admission);
  for (let n = 0; n < 3; n++) expect(await t.mutation(api.loyalty.enroll, args(1, bad))).toMatchObject({ reason: "STAFF_PIN_INVALID" });
  now = Date.UTC(2026, 10, 23, 8, 45); vi.setSystemTime(now);
  expect(await t.mutation(api.loyalty.enroll, args(1, bad))).toMatchObject({ reason: "STAFF_PIN_LOCKED" });
  now = Date.UTC(2026, 10, 23, 9); vi.setSystemTime(now);
  expect(await t.mutation(api.loyalty.enroll, args(1))).toMatchObject({ reason: "STAFF_PIN_LOCKED" });
  now = Date.UTC(2026, 10, 23, 9, 44, 59); vi.setSystemTime(now);
  expect(await t.mutation(api.loyalty.enroll, args(1, digest))).toMatchObject({ reason: "STAFF_PIN_LOCKED" });
  now = Date.UTC(2026, 10, 23, 9, 45, 1); vi.setSystemTime(now);
  expect((await t.mutation(api.loyalty.enroll, args(1))).ok).toBe(true);
});
