import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";
import { hashPassword, verifyPassword } from "./lib/password";
import { awardBalance, calendarMonths, expired } from "./loyaltyRules";

const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
function fail(message: string): never {
  throw new ConvexError(message);
}
const clean = (s: string, max = 200) => {
  const t = s.trim();
  if (!t || t.length > max) fail("Invalid or missing text");
  return t;
};
async function staff(
  ctx: QueryCtx,
  token: string,
  admin = false,
): Promise<string> {
  try {
    await requireAdmin(ctx, token);
    return "administrator";
  } catch {
    /* independent staff session */
  }
  const session = await ctx.db
    .query("loyaltySessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt <= Date.now())
    return fail("Please sign in again");
  const person = await ctx.db.get(session.staffId);
  if (!person?.active || admin) return fail("Access denied");
  return person.name;
}
async function limit(
  ctx: MutationCtx,
  key: string,
  max: number,
  duration: number,
) {
  const row = await ctx.db
    .query("loyaltyLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const now = Date.now();
  if (row && row.until > now && row.count >= max)
    fail("Too many requests. Try again later.");
  if (row)
    await ctx.db.patch(
      row._id,
      row.until <= now
        ? { count: 1, until: now + duration }
        : { count: row.count + 1 },
    );
  else
    await ctx.db.insert("loyaltyLimits", {
      key,
      count: 1,
      until: now + duration,
    });
}
const shortCode = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
async function readMember(ctx: QueryCtx, code: string) {
  if (/^[a-f0-9]{64}$/.test(code))
    return ctx.db
      .query("loyaltyMembers")
      .withIndex("by_qr", (q) => q.eq("qr", code))
      .unique();
  if (/^[A-Za-z0-9_-]{22}$/.test(code))
    return ctx.db
      .query("loyaltyMembers")
      .withIndex("by_public_code", (q) => q.eq("publicCode", code))
      .unique();
  return null;
}
async function member(ctx: QueryCtx, code: string) {
  const m = await readMember(ctx, code);
  if (!m || m.revoked) return fail("Card not recognized or revoked");
  return m;
}
async function touchCard(ctx: MutationCtx, memberId: Id<"loyaltyMembers">) {
  await ctx.db.patch(memberId, { updatedAt: Date.now() });
}
type Counters =
  | "members"
  | "stampsIssued"
  | "stampsExpired"
  | "stampsReversed"
  | "rewardsEarned"
  | "rewardsRedeemed";
async function increment(
  ctx: MutationCtx,
  changes: Partial<Record<Counters, number>>,
) {
  const row = await ctx.db.query("loyaltyStats").first();
  const values = {
    members: 0,
    stampsIssued: 0,
    stampsExpired: 0,
    stampsReversed: 0,
    rewardsEarned: 0,
    rewardsRedeemed: 0,
  };
  for (const k of Object.keys(values) as Counters[])
    values[k] = (row?.[k] ?? 0) + (changes[k] ?? 0);
  if (row) await ctx.db.patch(row._id, values);
  else await ctx.db.insert("loyaltyStats", values);
}
async function expireMember(ctx: MutationCtx, memberId: Id<"loyaltyMembers">) {
  const now = Date.now();
  let changed = false;
  for (const b of await ctx.db
    .query("loyaltyBalances")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .collect()) {
    if (b.stamps > 0 && expired(b.expiresAt, now)) {
      const rules = await ctx.db.get(b.versionId);
      let count = b.stamps;
      let next: number | undefined;
      if (rules?.expiry === "fixed") {
        const lots = await ctx.db
          .query("loyaltyLots")
          .withIndex("by_balance", (q) => q.eq("balanceId", b._id))
          .collect();
        count = 0;
        for (const lot of lots) {
          if (lot.expiresAt <= now) {
            count += lot.remaining;
            await ctx.db.delete(lot._id);
          } else if (lot.remaining > 0)
            next =
              next === undefined
                ? lot.expiresAt
                : Math.min(next, lot.expiresAt);
        }
      }
      if (count) {
        await ctx.db.insert("loyaltyLedger", {
          memberId,
          programId: b.programId,
          kind: "expire",
          count: -count,
          at: now,
          actor: "system",
          key: crypto.randomUUID(),
          reference: "Stamp expiration",
        });
        await increment(ctx, { stampsExpired: count });
      }
      await ctx.db.patch(b._id, { stamps: b.stamps - count, expiresAt: next });
      changed = true;
    }
  }
  for (const r of await ctx.db
    .query("loyaltyRewards")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .collect()) {
    if (r.status === "available" && expired(r.expiresAt, now)) {
      await ctx.db.patch(r._id, { status: "expired" });
      changed = true;
    }
  }
  if (changed) await touchCard(ctx, memberId);
}
async function view(
  ctx: QueryCtx,
  memberId: Id<"loyaltyMembers">,
  allowRevoked = false,
) {
  const m = await ctx.db.get(memberId);
  if (!m || (m.revoked && !allowRevoked)) return fail("Card unavailable");
  const now = Date.now();
  const balances = await ctx.db
    .query("loyaltyBalances")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .collect();
  const programs = await ctx.db.query("loyaltyPrograms").collect();
  const progress = await Promise.all(
    programs
      .filter(
        (p) =>
          !["draft", "archived"].includes(p.status) ||
          balances.some((b) => b.programId === p._id),
      )
      .map(async (p) => {
        const b = balances.find((b) => b.programId === p._id);
        const rules = b
          ? await ctx.db.get(b.versionId)
          : await ctx.db
              .query("loyaltyVersions")
              .withIndex("by_program", (q) =>
                q.eq("programId", p._id).eq("version", p.version),
              )
              .unique();
        let stamps = b && !expired(b.expiresAt, now) ? b.stamps : 0;
        let expiresAt = b?.expiresAt;
        if (b && rules?.expiry === "fixed") {
          const lots = (
            await ctx.db
              .query("loyaltyLots")
              .withIndex("by_balance", (q) => q.eq("balanceId", b._id))
              .collect()
          ).filter((l) => l.expiresAt > now && l.remaining > 0);
          stamps = lots.reduce((n, l) => n + l.remaining, 0);
          expiresAt = lots[0]?.expiresAt;
        }
        const rewardItemId = rules ? rules.rewardItemId : p.rewardItemId;
        const rewardItem = rewardItemId ? await ctx.db.get(rewardItemId) : null;
        return {
          ...p,
          reward: rules?.reward ?? p.reward,
          rewardNames: rewardItem?.name ??
            rules?.rewardNames ??
            p.rewardNames ?? { ka: rules?.reward ?? p.reward },
          rewardImageUrl: null,
          stamps,
          expiresAt,
          threshold: rules?.threshold ?? 10,
        };
      }),
  );
  const rewards = await Promise.all(
    (
      await ctx.db
        .query("loyaltyRewards")
        .withIndex("by_member", (q) => q.eq("memberId", memberId))
        .collect()
    ).map(async (r) => {
      const version = await ctx.db.get(r.versionId);
      const item = version?.rewardItemId
        ? await ctx.db.get(version.rewardItemId)
        : null;
      return {
        ...r,
        rewardNames: item?.name ?? version?.rewardNames ?? { ka: r.label },
        status:
          r.status === "available" && expired(r.expiresAt, now)
            ? "expired"
            : r.status,
      };
    }),
  );
  const brand = await ctx.db.query("loyaltyBrand").first();
  return {
    revoked: m.revoked,
    qr: m.qr,
    publicCode: m.publicCode,
    serial: m._id,
    offers: [],
    updatedAt: m.updatedAt,
    programs: progress,
    rewards,
    terms: brand?.terms ?? { ka: "", en: "", ru: "" },
    brand: brand ?? {
      name: "Suro",
      color: "#213b32",
      latitude: undefined,
      longitude: undefined,
    },
  };
}

export const enrollmentPreview = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const programs = await ctx.db.query("loyaltyPrograms").collect();
    const p = programs.find(
      (p) =>
        p.status === "active" &&
        (!p.startsAt || p.startsAt <= now) &&
        !expired(p.endsAt, now),
    );
    if (!p) return null;
    const rules = await ctx.db
      .query("loyaltyVersions")
      .withIndex("by_program", (q) =>
        q.eq("programId", p._id).eq("version", p.version),
      )
      .unique();
    if (!rules || rules.threshold < 3 || expired(rules.campaignEndAt, now))
      return null;
    return {
      threshold: rules.threshold,
      reward: rules.reward,
      rewardNames: rules.rewardNames ?? p.rewardNames,
    };
  },
});

// Enrollment is admitted only by the Next.js server; the secret is never public.
export const enroll = mutation({
  args: {
    admission: v.string(),
    bucket: v.string(),
    secret: v.string(),
    qr: v.string(),
  },
  handler: async (ctx, a) => {
    if (
      !process.env.LOYALTY_ADMISSION_SECRET ||
      a.admission !== process.env.LOYALTY_ADMISSION_SECRET
    )
      fail("Enrollment is not configured");
    if (
      !/^[a-f0-9]{64}$/.test(a.secret) ||
      !/^[a-f0-9]{64}$/.test(a.qr) ||
      a.bucket.length > 100
    )
      fail("Invalid enrollment");
    const existing = await ctx.db
      .query("loyaltyMembers")
      .withIndex("by_secret", (q) => q.eq("secret", a.secret))
      .unique();
    if (existing?.revoked)
      fail("This card was revoked. Please ask the café team.");
    if (existing)
      return {
        secret: existing.secret,
        code: existing.publicCode ?? existing.qr,
      };
    await limit(ctx, `signup:${a.bucket}`, 5, 3600_000);
    await limit(ctx, "signup:global", 200, 3600_000);
    const code = shortCode();
    const memberId = await ctx.db.insert("loyaltyMembers", {
      consentedAt: Date.now(),
      consentVersion: "2026-11-23",
      qr: a.qr,
      publicCode: code,
      secret: a.secret,
      revoked: false,
      updatedAt: Date.now(),
    });
    await increment(ctx, { members: 1 });
    // Welcome awards are committed once with membership creation, never on page visits.
    const now = Date.now();
    const programs = await ctx.db.query("loyaltyPrograms").collect();
    const program = programs.find(
      (p) =>
        p.status === "active" &&
        (!p.startsAt || p.startsAt <= now) &&
        !expired(p.endsAt, now),
    );
    if (!program) fail("No active loyalty program");
    if (program) {
      const rules = await ctx.db
        .query("loyaltyVersions")
        .withIndex("by_program", (q) =>
          q.eq("programId", program._id).eq("version", program.version),
        )
        .unique();
      if (!rules || rules.threshold < 3)
        fail("Program does not support welcome stamps");
      if (rules && rules.threshold >= 3 && !expired(rules.campaignEndAt, now)) {
        const expiresAt =
          rules.expiry === "never"
            ? undefined
            : rules.expiry === "campaign"
              ? rules.campaignEndAt
              : calendarMonths(now, rules.months);
        const balanceId = await ctx.db.insert("loyaltyBalances", {
          memberId,
          programId: program._id,
          versionId: rules._id,
          stamps: 2,
          expiresAt,
        });
        for (const [index, reference] of [
          "First visit",
          "Welcome gift",
        ].entries()) {
          const key = `welcome:${memberId}:${index}`;
          await ctx.db.insert("loyaltyLedger", {
            memberId,
            programId: program._id,
            kind: "award",
            count: 1,
            at: now,
            actor: "system",
            key,
            reference,
          });
          if (rules.expiry === "fixed")
            await ctx.db.insert("loyaltyLots", {
              balanceId,
              remaining: 1,
              expiresAt: expiresAt!,
              key,
            });
        }
        await ctx.db.patch(memberId, { lastActiveAt: now, welcomeProgramId: program._id });
        await increment(ctx, { stampsIssued: 2 });
      }
    }
    return { secret: a.secret, code };
  },
});
export const card = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const m = await ctx.db
      .query("loyaltyMembers")
      .withIndex("by_secret", (q) => q.eq("secret", secret))
      .unique();
    return m ? view(ctx, m._id, true) : null;
  },
});
export const lookup = mutation({
  args: { token: v.string(), qr: v.string() },
  handler: async (ctx, a) => {
    await staff(ctx, a.token);
    const m = await member(ctx, a.qr);
    await expireMember(ctx, m._id);
    return {
      ...(await view(ctx, m._id)),
      history: await ctx.db
        .query("loyaltyLedger")
        .withIndex("by_member", (q) => q.eq("memberId", m._id))
        .order("desc")
        .take(30),
    };
  },
});
export const issue = mutation({
  args: {
    token: v.string(),
    qr: v.string(),
    programId: v.id("loyaltyPrograms"),
    count: v.number(),
    key: v.string(),
    reference: v.string(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token);
    clean(a.key, 100);
    const reference = clean(a.reference);
    const m = await member(ctx, a.qr);
    const prior = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_key", (q) => q.eq("key", a.key))
      .unique();
    if (prior) {
      if (
        prior.memberId !== m._id ||
        prior.programId !== a.programId ||
        prior.count !== a.count ||
        prior.kind !== "award" ||
        prior.reference !== reference
      )
        fail("Transaction key was already used");
      return;
    }
    const p = await ctx.db.get(a.programId);
    const now = Date.now();
    if (
      !p ||
      p.status !== "active" ||
      (p.startsAt !== undefined && p.startsAt > now) ||
      expired(p.endsAt, now)
    )
      fail("Program is not accepting stamps");
    await expireMember(ctx, m._id);
    const b = await ctx.db
      .query("loyaltyBalances")
      .withIndex("by_pair", (q) =>
        q.eq("memberId", m._id).eq("programId", p._id),
      )
      .unique();
    const rules =
      b && b.stamps > 0
        ? await ctx.db.get(b.versionId)
        : await ctx.db
            .query("loyaltyVersions")
            .withIndex("by_program", (q) =>
              q.eq("programId", p._id).eq("version", p.version),
            )
            .unique();
    if (!rules) return fail("Program rules missing");
    const purchase = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_purchase", (q) =>
        q
          .eq("memberId", m._id)
          .eq("programId", p._id)
          .eq("reference", reference)
          .eq("kind", "award"),
      )
      .first();
    if (purchase) fail("This purchase was already stamped");
    const recent = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_member", (q) => q.eq("memberId", m._id))
      .order("desc")
      .take(20);
    if (
      recent.some(
        (t) =>
          t.programId === p._id &&
          t.kind === "award" &&
          (now - t.at < 10_000 || t.reference === reference),
      )
    )
      fail("Purchase already stamped or scanned too recently");
    const result = awardBalance(b?.stamps ?? 0, a.count, rules.threshold);
    let expiresAt =
      result.stamps === 0
        ? undefined
        : rules.expiry === "rolling"
          ? calendarMonths(now, rules.months)
          : rules.expiry === "campaign"
            ? rules.campaignEndAt
            : undefined;
    if (rules.expiry === "campaign" && !rules.campaignEndAt)
      fail("Campaign needs an end date");
    const values = {
      memberId: m._id,
      programId: p._id,
      versionId: rules._id,
      stamps: result.stamps,
      expiresAt,
    };
    const balanceId = b
      ? b._id
      : await ctx.db.insert("loyaltyBalances", values);
    if (rules.expiry === "fixed") {
      await ctx.db.insert("loyaltyLots", {
        balanceId,
        remaining: a.count,
        expiresAt: calendarMonths(now, rules.months),
        key: a.key,
      });
      const lots = await ctx.db
        .query("loyaltyLots")
        .withIndex("by_balance", (q) => q.eq("balanceId", balanceId))
        .collect();
      let consume = result.rewards * rules.threshold;
      for (const lot of lots) {
        const used = Math.min(consume, lot.remaining);
        consume -= used;
        const remaining = lot.remaining - used;
        if (remaining === 0) await ctx.db.delete(lot._id);
        else {
          await ctx.db.patch(lot._id, { remaining });
          expiresAt =
            expiresAt === undefined
              ? lot.expiresAt
              : Math.min(expiresAt, lot.expiresAt);
        }
      }
      values.expiresAt = expiresAt;
    }
    await ctx.db.patch(balanceId, values);
    await ctx.db.patch(m._id, { lastActiveAt: now });
    await increment(ctx, {
      stampsIssued: a.count,
      rewardsEarned: result.rewards,
    });
    for (let i = 0; i < result.rewards; i++)
      await ctx.db.insert("loyaltyRewards", {
        memberId: m._id,
        programId: p._id,
        versionId: rules._id,
        label: rules.reward,
        status: "available",
        earnedAt: now,
        expiresAt: rules.rewardDays
          ? now + rules.rewardDays * 86400_000
          : undefined,
      });
    await ctx.db.insert("loyaltyLedger", {
      memberId: m._id,
      programId: p._id,
      kind: "award",
      count: a.count,
      at: now,
      actor,
      key: a.key,
      reference,
    });
    await touchCard(ctx, m._id);
  },
});
export const redeem = mutation({
  args: {
    token: v.string(),
    qr: v.string(),
    rewardId: v.id("loyaltyRewards"),
    key: v.string(),
    confirmed: v.boolean(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    clean(a.key, 100);
    if (!a.confirmed) fail("Confirm the customer before redemption");
    const m = await member(ctx, a.qr);
    const r = await ctx.db.get(a.rewardId);
    const prior = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_key", (q) => q.eq("key", a.key))
      .unique();
    if (prior) {
      if (
        prior.rewardId !== a.rewardId ||
        prior.memberId !== m._id ||
        prior.kind !== "redeem"
      )
        fail("Transaction key was already used");
      return;
    }
    if (
      !r ||
      r.memberId !== m._id ||
      r.status !== "available" ||
      expired(r.expiresAt, Date.now())
    )
      fail("Reward is no longer available");
    await expireMember(ctx, m._id);
    await ctx.db.patch(r._id, { status: "redeemed", redeemedAt: Date.now() });
    await ctx.db.insert("loyaltyLedger", {
      memberId: m._id,
      programId: r.programId,
      kind: "redeem",
      count: 0,
      at: Date.now(),
      actor,
      key: a.key,
      reference: "Customer verified by staff",
      rewardId: r._id,
    });
    await increment(ctx, { rewardsRedeemed: 1 });
    await ctx.db.patch(m._id, { lastActiveAt: Date.now() });
    await touchCard(ctx, m._id);
  },
});
export const reverse = mutation({
  args: {
    token: v.string(),
    transactionId: v.id("loyaltyLedger"),
    reason: v.string(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    const reason = clean(a.reason);
    const t = await ctx.db.get(a.transactionId);
    if (!t || t.kind !== "award" || t.reversedBy)
      fail("Cannot reverse this transaction");
    await expireMember(ctx, t.memberId);
    const b = await ctx.db
      .query("loyaltyBalances")
      .withIndex("by_pair", (q) =>
        q.eq("memberId", t.memberId).eq("programId", t.programId),
      )
      .unique();
    // Never silently claw back earned/redeemed entitlements. Escalate complex corrections.
    if (!b || b.stamps < t.count)
      fail(
        "This purchase created a reward or its stamps expired; review entitlements before correction",
      );
    const rules = await ctx.db.get(b.versionId);
    if (rules?.expiry === "fixed") {
      const lots = await ctx.db
        .query("loyaltyLots")
        .withIndex("by_balance", (q) => q.eq("balanceId", b._id))
        .collect();
      const lot = lots.find((l) => l.key === t.key);
      if (!lot || lot.remaining < t.count)
        fail(
          "Some stamps from this purchase were already used; review entitlements first",
        );
      if (lot.remaining === t.count) await ctx.db.delete(lot._id);
      else await ctx.db.patch(lot._id, { remaining: lot.remaining - t.count });
      const next = lots.filter((l) => l._id !== lot._id && l.remaining > 0)[0]
        ?.expiresAt;
      await ctx.db.patch(b._id, { expiresAt: next });
    }
    await increment(ctx, { stampsReversed: t.count });
    const id = await ctx.db.insert("loyaltyLedger", {
      memberId: t.memberId,
      programId: t.programId,
      kind: "reverse",
      count: -t.count,
      at: Date.now(),
      actor,
      key: crypto.randomUUID(),
      reference: reason,
    });
    await ctx.db.patch(t._id, { reversedBy: id });
    await ctx.db.patch(b._id, { stamps: b.stamps - t.count });
    await touchCard(ctx, t.memberId);
  },
});
export const dashboard = query({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    await staff(ctx, a.token, true);
    return {
      programs: await ctx.db.query("loyaltyPrograms").collect(),
      versions: await ctx.db.query("loyaltyVersions").collect(),
      staff: (await ctx.db.query("loyaltyStaff").collect()).map(
        ({ hash: _hash, ...s }) => s,
      ),
      brand: await ctx.db.query("loyaltyBrand").first(),
      audit: await ctx.db
        .query("loyaltyAudit")
        .withIndex("by_at")
        .order("desc")
        .take(30),
    };
  },
});
export const saveProgram = mutation({
  args: {
    token: v.string(),
    id: v.optional(v.id("loyaltyPrograms")),
    name: v.string(),
    description: v.string(),
    products: v.string(),
    reward: v.string(),
    rewardImage: v.optional(v.id("_storage")),
    rewardItemId: v.optional(v.id("items")),
    threshold: v.number(),
    expiry: v.string(),
    months: v.number(),
    rewardDays: v.optional(v.number()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    const p = a.id ? await ctx.db.get(a.id) : null;
    if (a.id && !p) fail("Program missing");
    const rewardItemId = a.rewardItemId ?? p?.rewardItemId;
    const item = rewardItemId ? await ctx.db.get(rewardItemId) : null;
    if (!item || item.hidden) fail("Choose a reward item from the menu");
    if (a.rewardImage && a.rewardImage !== item.photo)
      fail("Reward photos must come from the selected menu item");
    const name = clean(a.name, 80);
    const reward = clean(item.name.ka || item.name.en || item.name.ru || "");
    const rewardImage = item.photo;
    clean(a.products, 1000);
    if (
      !Number.isInteger(a.threshold) ||
      a.threshold < 1 ||
      a.threshold > 100 ||
      !["rolling", "fixed", "never", "campaign"].includes(a.expiry)
    )
      fail("Invalid program rules");
    calendarMonths(Date.now(), a.months);
    if (
      a.rewardDays !== undefined &&
      (!Number.isInteger(a.rewardDays) ||
        a.rewardDays < 1 ||
        a.rewardDays > 3650)
    )
      fail("Invalid reward duration");
    if (
      a.description.length > 1000 ||
      (a.startsAt !== undefined && !Number.isFinite(a.startsAt)) ||
      (a.endsAt !== undefined && !Number.isFinite(a.endsAt))
    )
      fail("Invalid program dates or description");
    if (a.expiry === "campaign" && !a.endsAt)
      fail("Campaign expiry needs an end date");
    if (a.startsAt && a.endsAt && a.startsAt >= a.endsAt)
      fail("End must follow start");
    const version = (p?.version ?? 0) + 1;
    const data = {
      name,
      description: a.description.trim(),
      products: a.products.trim(),
      reward,
      rewardImage,
      rewardItemId,
      rewardNames: item.name,
      version,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    };
    const id = p
      ? p._id
      : await ctx.db.insert("loyaltyPrograms", { ...data, status: "draft" });
    if (p) await ctx.db.patch(id, data);
    await ctx.db.insert("loyaltyVersions", {
      programId: id,
      version,
      threshold: a.threshold,
      expiry: a.expiry,
      months: a.months,
      rewardDays: a.rewardDays,
      campaignEndAt: a.endsAt,
      reward,
      rewardImage,
      rewardItemId,
      rewardNames: item.name,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "program.rules",
      detail: `${name}: version ${version}`,
      at: Date.now(),
    });
    return id;
  },
});
export const setStatus = mutation({
  args: { token: v.string(), id: v.id("loyaltyPrograms"), status: v.string() },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    if (
      !["draft", "scheduled", "active", "paused", "ended", "archived"].includes(
        a.status,
      )
    )
      fail("Invalid status");
    const p = await ctx.db.get(a.id);
    if (!p) fail("Program missing");
    if (a.status === "scheduled" && (!p.startsAt || p.startsAt <= Date.now()))
      fail("Set a future start date first");
    await ctx.db.patch(a.id, { status: a.status });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "program.status",
      detail: `${p.name}: ${a.status}`,
      at: Date.now(),
    });
  },
});
export const staffRecords = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("loyaltyStaff").collect();
    return rows.filter((row) => row.active);
  },
});
export const loginAttempt = internalMutation({
  args: {},
  handler: async (ctx) => {
    await limit(ctx, "staff:global", 30, 600_000);
  },
});
export const createSession = internalMutation({
  args: {
    staffId: v.id("loyaltyStaff"),
    token: v.string(),
    expectedHash: v.string(),
  },
  handler: async (ctx, a) => {
    const person = await ctx.db.get(a.staffId);
    if (!person?.active || person.hash !== a.expectedHash)
      fail("Please sign in again");
    await ctx.db.insert("loyaltySessions", {
      staffId: a.staffId,
      token: a.token,
      expiresAt: Date.now() + 12 * 3600_000,
    });
  },
});
export const login = action({
  args: { password: v.string() },
  handler: async (ctx, a): Promise<string> => {
    await ctx.runMutation(internal.loyalty.loginAttempt, {});
    if (a.password.length < 12 || a.password.length > 200)
      fail("Invalid staff password");
    const rows = await ctx.runQuery(internal.loyalty.staffRecords, {});
    const matches = [];
    for (const person of rows)
      if (await verifyPassword(a.password, person.hash)) matches.push(person);
    if (matches.length !== 1) fail("Invalid staff password");
    const person = matches[0];
    const token = random();
    await ctx.runMutation(internal.loyalty.createSession, {
      staffId: person._id,
      token,
      expectedHash: person.hash,
    });
    return token;
  },
});
export const addStaff = action({
  args: {
    token: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.string(),
  },
  handler: async (ctx, a) => {
    await ctx.runQuery(internal.loyalty.authorize, { token: a.token });
    if (a.password.length < 12 || a.password.length > 200)
      fail("Use a password of 12–200 characters");
    for (const person of await ctx.runQuery(
      internal.loyalty.staffRecords,
      {},
    )) {
      if (await verifyPassword(a.password, person.hash))
        fail("Each staff member needs a different password");
    }
    await ctx.runMutation(internal.loyalty.insertStaff, {
      token: a.token,
      name: clean(a.name, 80).toLowerCase(),
      hash: await hashPassword(a.password),
      role: a.role,
    });
  },
});
export const authorize = internalQuery({
  args: { token: v.string() },
  handler: (ctx, a) => staff(ctx, a.token, true),
});
export const insertStaff = internalMutation({
  args: {
    token: v.string(),
    name: v.string(),
    hash: v.string(),
    role: v.string(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    if (a.role !== "staff") fail("Invalid role");
    if (
      await ctx.db
        .query("loyaltyStaff")
        .withIndex("by_name", (q) => q.eq("name", a.name))
        .unique()
    )
      fail("Staff name already exists");
    await ctx.db.insert("loyaltyStaff", {
      name: a.name,
      hash: a.hash,
      role: a.role,
      active: true,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "staff.created",
      detail: a.name,
      at: Date.now(),
    });
  },
});
export const revokeStaff = mutation({
  args: { token: v.string(), id: v.id("loyaltyStaff") },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    await ctx.db.patch(a.id, { active: false });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "staff.revoked",
      detail: a.id,
      at: Date.now(),
    });
  },
});
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    const s = await ctx.db
      .query("loyaltySessions")
      .withIndex("by_token", (q) => q.eq("token", a.token))
      .unique();
    if (s) await ctx.db.delete(s._id);
  },
});
export const maintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const balances = await ctx.db
      .query("loyaltyBalances")
      .withIndex("by_expiry", (q) => q.gt("expiresAt", 0).lte("expiresAt", now))
      .take(100);
    for (const id of new Set(balances.map((b) => b.memberId)))
      await expireMember(ctx, id);
    const rewards = await ctx.db
      .query("loyaltyRewards")
      .withIndex("by_expiry", (q) =>
        q.eq("status", "available").gt("expiresAt", 0).lte("expiresAt", now),
      )
      .take(100);
    for (const id of new Set(rewards.map((r) => r.memberId)))
      await expireMember(ctx, id);
    for (const p of await ctx.db.query("loyaltyPrograms").collect()) {
      if (
        p.endsAt &&
        p.endsAt <= now &&
        ["active", "scheduled", "paused"].includes(p.status)
      ) {
        await ctx.db.patch(p._id, { status: "ended" });
      } else if (p.status === "scheduled" && p.startsAt && p.startsAt <= now) {
        await ctx.db.patch(p._id, { status: "active" });
      }
    }
  },
});

export { staff as requireLoyaltyStaff };
export const access = query({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    try {
      await staff(ctx, a.token, true);
      return true;
    } catch {
      return false;
    }
  },
});

export const cancelReward = mutation({
  args: {
    token: v.string(),
    qr: v.string(),
    rewardId: v.id("loyaltyRewards"),
    reason: v.string(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    const m = await member(ctx, a.qr);
    const reason = clean(a.reason);
    const reward = await ctx.db.get(a.rewardId);
    if (!reward || reward.memberId !== m._id) fail("Reward not found");
    if (reward.status === "cancelled") return;
    if (reward.status !== "available" || expired(reward.expiresAt, Date.now()))
      fail("Only available rewards can be cancelled");
    await ctx.db.patch(reward._id, { status: "cancelled" });
    await ctx.db.insert("loyaltyLedger", {
      memberId: m._id,
      programId: reward.programId,
      rewardId: reward._id,
      kind: "cancel",
      count: 0,
      key: `cancel:${reward._id}`,
      reference: reason,
      at: Date.now(),
      actor,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "reward.cancelled",
      detail: `${reward._id}: ${reason}`,
      at: Date.now(),
    });
    await touchCard(ctx, m._id);
  },
});

// The random public code is read-only: it exposes no customer secret, staff, receipts, or ledger.
export const publicCard = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const m = await readMember(ctx, code);
    if (!m) return null;
    if (m.revoked)
      return {
        revoked: true,
        publicCode: m.publicCode,
        brand: { name: "Suro", color: "#213b32" },
        programs: [],
        rewards: [],
        offers: [],
        updatedAt: m.updatedAt,
      };
    const data = await view(ctx, m._id);
    return {
      revoked: false,
      publicCode: m.publicCode,
      welcomeProgramId: m.welcomeProgramId,
      brand: { name: data.brand.name, color: data.brand.color },
      updatedAt: data.updatedAt,
      terms: data.terms,
      programs: data.programs.map((p) => ({
        id: p._id,
        name: p.name,
        reward: p.reward,
        rewardNames: p.rewardNames,
        rewardImageUrl: p.rewardImageUrl,
        stamps: p.stamps,
        threshold: p.threshold,
        expiresAt: p.expiresAt,
      })),
      rewards: data.rewards
        .filter((r) => r.status === "available")
        .map((r) => ({
          label: r.label,
          rewardNames: r.rewardNames,
          expiresAt: r.expiresAt,
        })),
      offers: [],
    };
  },
});

export const revokeCard = mutation({
  args: { token: v.string(), qr: v.string(), reason: v.string() },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    const reason = clean(a.reason);
    const m = await member(ctx, a.qr);
    await ctx.db.patch(m._id, { revoked: true, updatedAt: Date.now() });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "card.revoked",
      detail: `${m._id}: ${reason}`,
      at: Date.now(),
    });
  },
});

export const resetStaffPassword = action({
  args: { token: v.string(), id: v.id("loyaltyStaff"), password: v.string() },
  handler: async (ctx, a) => {
    await ctx.runQuery(internal.loyalty.authorize, { token: a.token });
    if (a.password.length < 12 || a.password.length > 200)
      fail("Use a password of 12–200 characters");
    for (const person of await ctx.runQuery(internal.loyalty.staffRecords, {}))
      if (
        person._id !== a.id &&
        (await verifyPassword(a.password, person.hash))
      )
        fail("Each staff member needs a different password");
    await ctx.runMutation(internal.loyalty.replaceStaffPassword, {
      token: a.token,
      id: a.id,
      hash: await hashPassword(a.password),
    });
  },
});
export const replaceStaffPassword = internalMutation({
  args: { token: v.string(), id: v.id("loyaltyStaff"), hash: v.string() },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    const person = await ctx.db.get(a.id);
    if (!person) fail("Staff member not found");
    await ctx.db.patch(a.id, { hash: a.hash });
    for (const session of await ctx.db
      .query("loyaltySessions")
      .withIndex("by_staff", (q) => q.eq("staffId", a.id))
      .collect())
      await ctx.db.delete(session._id);
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "staff.password_reset",
      detail: person.name,
      at: Date.now(),
    });
  },
});
export const saveTerms = mutation({
  args: {
    token: v.string(),
    terms: v.object({ ka: v.string(), en: v.string(), ru: v.string() }),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true);
    for (const value of Object.values(a.terms))
      if (value.length > 12000)
        fail("Terms must be under 12,000 characters per language");
    const row = await ctx.db.query("loyaltyBrand").first();
    if (row) await ctx.db.patch(row._id, { terms: a.terms });
    else
      await ctx.db.insert("loyaltyBrand", {
        name: "Suro",
        color: "#244c3b",
        terms: a.terms,
      });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "terms.updated",
      detail: "Card terms updated",
      at: Date.now(),
    });
  },
});
export const rewardItems = query({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    await staff(ctx, a.token, true);
    return (await ctx.db.query("items").collect())
      .filter((item) => !item.hidden)
      .map((item) => ({ id: item._id, name: item.name }));
  },
});
export const publicTerms = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("loyaltyBrand").first())?.terms ?? null,
});
