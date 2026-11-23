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
import { encryptCredential, decryptCredential } from "./lib/credentialDisplay";
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
          p.status === "active" || balances.some((b) => b.programId === p._id),
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
        const rewardItemId = rules?.rewardItemId ?? p.rewardItemId;
        const rewardItem = rewardItemId ? await ctx.db.get(rewardItemId) : null;
        return {
          ...p,
          reward: rules?.reward ?? p.reward,
          rewardNames: rewardItem?.name ??
            rules?.rewardNames ??
            p.rewardNames ?? { ka: rules?.reward ?? p.reward },
          rewardImageUrl: rewardItem?.photo
            ? await ctx.storage.getUrl(rewardItem.photo)
            : null,
          rewardDescriptions: rewardItem?.description,
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
        rewardImageUrl: item?.photo
          ? await ctx.storage.getUrl(item.photo)
          : null,
        rewardDescriptions: item?.description,
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
    createdAt: m.createdAt ?? m._creationTime,
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
      welcomeStamps: p.welcomeStamps ?? 2,
      reward: rules.reward,
      rewardNames: rules.rewardNames ?? p.rewardNames,
    };
  },
});

const SIGNUP_HOUR = 3600_000;
const SIGNUP_FREE_LIMIT = 50;
async function signupHour(ctx: QueryCtx | MutationCtx) {
  const now = Date.now();
  const row = await ctx.db
    .query("loyaltyLimits")
    .withIndex("by_key", (q) => q.eq("key", "signup:hourly"))
    .unique();
  return {
    row,
    count: row && row.until > now ? row.count : 0,
    resetsAt: (Math.floor(now / SIGNUP_HOUR) + 1) * SIGNUP_HOUR,
  };
}
async function pinAttemptState(
  ctx: MutationCtx,
  bucket: string,
  secret: string,
) {
  const read = async (key: string, max: number, duration: number) => {
    const row = await ctx.db
      .query("loyaltyLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const active = row && row.until > Date.now();
    return {
      key,
      row,
      count: active ? row.count : 0,
      until: active ? row.until : Date.now() + duration,
      max,
    };
  };
  return Promise.all([
    read(`signup:pin:browser:${secret}`, 4, SIGNUP_HOUR),
    read(`signup:pin:network:${bucket}`, 30, 60_000),
  ]);
}
function samePinDigest(a: string, b: string) {
  let different = a.length ^ b.length;
  for (let i = 0; i < b.length; i++)
    different |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return different === 0;
}
export const setSignupPin = action({
  args: { token: v.string(), pin: v.string() },
  handler: async (ctx, a) => {
    await ctx.runQuery(internal.loyalty.authorize, { token: a.token });
    if (!/^\d{6}$/.test(a.pin)) fail("Use a six-digit PIN");
    const admission = process.env.LOYALTY_ADMISSION_SECRET;
    if (!admission) fail("Enrollment is not configured");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(admission),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`signup-pin:${a.pin}`),
      ),
    );
    const pinDigest = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    await ctx.runMutation(internal.loyalty.storeSignupPin, {
      token: a.token,
      pinDigest,
      displaySecret: await encryptCredential(a.pin, "pin"),
    });
  },
});
export const storeSignupPin = internalMutation({
  args: {
    token: v.string(),
    pinDigest: v.string(),
    displaySecret: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await staff(ctx, a.token, true);
    const row = await ctx.db.query("loyaltySignupSettings").first();
    const data = {
      pinDigest: a.pinDigest,
      displaySecret: a.displaySecret,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, data);
    else await ctx.db.insert("loyaltySignupSettings", data);
    await ctx.db.insert("loyaltyAudit", {
      actor: "administrator",
      event: "signup.pin_changed",
      detail: "Staff signup PIN changed",
      at: Date.now(),
    });
  },
});

// Initial setup through the authenticated Convex CLI; later changes use admin settings.
export const initializeSignupPin = internalMutation({
  args: { pinDigest: v.string() },
  handler: async (ctx, a) => {
    if (!/^[a-f0-9]{64}$/.test(a.pinDigest)) fail("Invalid PIN digest");
    if (await ctx.db.query("loyaltySignupSettings").first())
      fail("Signup PIN already configured");
    const now = Date.now();
    await ctx.db.insert("loyaltySignupSettings", {
      pinDigest: a.pinDigest,
      updatedAt: now,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor: "administrator",
      event: "signup.pin_changed",
      detail: "Initial staff signup PIN configured",
      at: now,
    });
  },
});

// Enrollment is admitted only by the Next.js server; the secret is never public.
export const enroll = mutation({
  args: {
    admission: v.string(),
    bucket: v.string(),
    pinDigest: v.optional(v.string()),
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
      !a.bucket ||
      a.bucket.length > 100 ||
      (a.pinDigest !== undefined && !/^[a-f0-9]{64}$/.test(a.pinDigest))
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
        ok: true as const,
        secret: existing.secret,
        code: existing.publicCode ?? existing.qr,
      };
    const browserAttempts = await ctx.db
      .query("loyaltyLimits")
      .withIndex("by_key", (q) => q.eq("key", `signup:pin:browser:${a.secret}`))
      .unique();
    if (
      browserAttempts &&
      browserAttempts.count >= 4 &&
      browserAttempts.until > Date.now()
    )
      return {
        ok: false as const,
        reason: "STAFF_PIN_LOCKED" as const,
        resetsAt: browserAttempts.until,
      };
    const hour = await signupHour(ctx);
    let staffApproved = false;
    if (hour.count >= SIGNUP_FREE_LIMIT) {
      if (!a.pinDigest)
        return {
          ok: false as const,
          reason: "STAFF_PIN_REQUIRED" as const,
          resetsAt: hour.resetsAt,
        };
      const settings = await ctx.db.query("loyaltySignupSettings").first();
      if (!settings)
        return {
          ok: false as const,
          reason: "STAFF_PIN_NOT_CONFIGURED" as const,
          resetsAt: hour.resetsAt,
        };
      const attempts = await pinAttemptState(ctx, a.bucket, a.secret);
      const lockedUntil = Math.max(
        0,
        ...attempts
          .filter((row) => row.count >= row.max)
          .map((row) => row.until),
      );
      if (lockedUntil > Date.now())
        return {
          ok: false as const,
          reason: "STAFF_PIN_LOCKED" as const,
          resetsAt: lockedUntil,
        };
      if (!samePinDigest(a.pinDigest, settings.pinDigest)) {
        // Return instead of throwing: failed-attempt counters must commit.
        let blockedUntil = 0;
        for (const entry of attempts) {
          const count = entry.count + 1;
          const until =
            count >= entry.max && entry.key.startsWith("signup:pin:browser:")
              ? Date.now() + SIGNUP_HOUR
              : entry.until;
          if (count >= entry.max) blockedUntil = Math.max(blockedUntil, until);
          const data = { count, until };
          if (entry.row) await ctx.db.patch(entry.row._id, data);
          else
            await ctx.db.insert("loyaltyLimits", { key: entry.key, ...data });
        }
        if (blockedUntil)
          return {
            ok: false as const,
            reason: "STAFF_PIN_LOCKED" as const,
            resetsAt: blockedUntil,
          };
        return {
          ok: false as const,
          reason: "STAFF_PIN_INVALID" as const,
          resetsAt: hour.resetsAt,
        };
      }
      staffApproved = true;
    }
    const now = Date.now();
    const counter = { count: hour.count + 1, until: hour.resetsAt };
    if (hour.row) await ctx.db.patch(hour.row._id, counter);
    else
      await ctx.db.insert("loyaltyLimits", {
        key: "signup:hourly",
        ...counter,
      });
    const code = shortCode();
    const memberId = await ctx.db.insert("loyaltyMembers", {
      createdAt: now,
      consentedAt: now,
      consentVersion: "2026-11-23",
      qr: a.qr,
      publicCode: code,
      secret: a.secret,
      revoked: false,
      updatedAt: now,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor: "system",
      event: "member.created",
      detail: `${memberId}${staffApproved ? " (staff PIN)" : ""}`,
      at: now,
    });
    await increment(ctx, { members: 1 });
    // Welcome awards are committed once with membership creation, never on page visits.
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
          stamps: program.welcomeStamps ?? 2,
          expiresAt,
        });
        const welcomeStamps = program.welcomeStamps ?? 2;
        for (let index = 0; index < welcomeStamps; index++) {
          const reference = index === 0 ? "First visit" : "Welcome gift";
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
        await ctx.db.patch(memberId, {
          lastActiveAt: now,
          welcomeProgramId: program._id,
          welcomeStamps,
        });
        await increment(ctx, { stampsIssued: welcomeStamps });
      }
    }
    return { ok: true as const, secret: a.secret, code };
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
async function issuedRewards(ctx: QueryCtx, ids: Id<"loyaltyRewards">[]) {
  const rewards = await Promise.all(
    ids.map(async (id) => {
      const reward = await ctx.db.get(id);
      if (!reward) return null;
      const rules = await ctx.db.get(reward.versionId);
      return {
        id: reward._id,
        label: reward.label,
        names: rules?.rewardNames,
        status:
          reward.status === "available" && expired(reward.expiresAt, Date.now())
            ? "expired"
            : reward.status,
        at: reward.earnedAt,
      };
    }),
  );
  return rewards.filter((r) => r !== null);
}
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
      const balance = await ctx.db
        .query("loyaltyBalances")
        .withIndex("by_pair", (q) =>
          q.eq("memberId", m._id).eq("programId", a.programId),
        )
        .unique();
      return {
        code: m.publicCode ?? m.qr,
        stamps: balance?.stamps ?? 0,
        expiresAt: balance?.expiresAt,
        rewards: await issuedRewards(ctx, prior.rewardIds ?? []),
      };
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
    const rewardIds: Id<"loyaltyRewards">[] = [];
    for (let i = 0; i < result.rewards; i++)
      rewardIds.push(
        await ctx.db.insert("loyaltyRewards", {
          memberId: m._id,
          programId: p._id,
          versionId: rules._id,
          label: rules.reward,
          status: "available",
          earnedAt: now,
          expiresAt: rules.rewardDays
            ? Math.min(now + rules.rewardDays * 86400_000, p.endsAt ?? Infinity)
            : p.endsAt,
        }),
      );
    await ctx.db.insert("loyaltyLedger", {
      memberId: m._id,
      programId: p._id,
      kind: "award",
      rewardIds,
      earnedReward: rewardIds.length > 0,
      count: a.count,
      at: now,
      actor,
      key: a.key,
      reference,
    });
    await touchCard(ctx, m._id);
    return {
      code: m.publicCode ?? m.qr,
      stamps: result.stamps,
      expiresAt,
      rewards: await issuedRewards(ctx, rewardIds),
    };
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
        ({ hash: _hash, displaySecret: _displaySecret, ...s }) => s,
      ),
      signupProtection: {
        pinConfigured: !!(await ctx.db.query("loyaltySignupSettings").first()),
        freeLimit: SIGNUP_FREE_LIMIT,
        count: (await signupHour(ctx)).count,
      },
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
    welcomeStamps: v.optional(v.number()),
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
    if (
      a.welcomeStamps !== undefined &&
      (![4, 6, 8, 10].includes(a.threshold) ||
        !Number.isInteger(a.welcomeStamps) ||
        a.welcomeStamps < 1 ||
        a.welcomeStamps >= a.threshold ||
        !a.endsAt ||
        a.endsAt <= Date.now())
    )
      fail(
        "Choose a future end date and fewer welcome stamps than the card total",
      );
    const version = (p?.version ?? 0) + 1;
    const data = {
      name,
      welcomeStamps: a.welcomeStamps ?? p?.welcomeStamps,
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
    if (p && a.welcomeStamps !== undefined) {
      for (const old of await ctx.db
        .query("loyaltyVersions")
        .withIndex("by_program", (q) => q.eq("programId", id))
        .collect())
        await ctx.db.patch(old._id, {
          expiry: "campaign",
          campaignEndAt: a.endsAt,
        });
      for (const balance of await ctx.db.query("loyaltyBalances").collect())
        if (balance.programId === id)
          await ctx.db.patch(balance._id, { expiresAt: a.endsAt });
    }
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
    if (a.status === "active" && expired(p.endsAt, Date.now()))
      fail("Choose a future end date before activating");
    if (a.status === "scheduled" && (!p.startsAt || p.startsAt <= Date.now()))
      fail("Set a future start date first");
    if (a.status === "active") {
      for (const other of await ctx.db.query("loyaltyPrograms").collect()) {
        if (
          other._id !== a.id &&
          ["active", "scheduled"].includes(other.status)
        ) {
          await ctx.db.patch(other._id, { status: "paused" });
          await ctx.db.insert("loyaltyAudit", {
            actor,
            event: "program.status",
            detail: `${other.name}: paused (another card activated)`,
            at: Date.now(),
          });
        }
      }
    }
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
  args: { password: v.string(), username: v.optional(v.string()) },
  handler: async (ctx, a): Promise<string> => {
    await ctx.runMutation(internal.loyalty.loginAttempt, {});
    if (
      (a.username !== undefined && a.username !== "staff") ||
      a.password.length < 8 ||
      a.password.length > 200
    )
      fail("Invalid staff credentials");
    const activeRows = await ctx.runQuery(internal.loyalty.staffRecords, {});
    const shared = activeRows.find((p) => p.name === "staff");
    const rows = shared ? [shared] : activeRows;
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
        for (const other of await ctx.db.query("loyaltyPrograms").collect())
          if (other._id !== p._id && other.status === "active")
            await ctx.db.patch(other._id, { status: "paused" });
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
      welcomeStamps: m.welcomeStamps ?? 2,
      brand: { name: data.brand.name, color: data.brand.color },
      updatedAt: data.updatedAt,
      terms: data.terms,
      programs: data.programs.map((p) => ({
        id: p._id,
        name: p.name,
        reward: p.reward,
        rewardNames: p.rewardNames,
        rewardImageUrl: p.rewardImageUrl,
        rewardDescriptions: p.rewardDescriptions,
        stamps: p.stamps,
        threshold: p.threshold,
        expiresAt: p.expiresAt,
      })),
      rewards: data.rewards
        .filter((r) => r.status === "available")
        .map((r) => ({
          id: r._id,
          label: r.label,
          rewardNames: r.rewardNames,
          rewardImageUrl: r.rewardImageUrl,
          rewardDescriptions: r.rewardDescriptions,
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
    await ctx.db.patch(a.id, { hash: a.hash, displaySecret: undefined });
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
    for (const value of Object.values(a.terms)) {
      if (!value.trim())
        fail("Fill Georgian, English and Russian before saving");
      if (value.length > 12000)
        fail("Terms must be under 12,000 characters per language");
    }
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

// Passwords arrive only at the server action; the configured credential is never bundled.
export const setSharedStaffPassword = action({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, a) => {
    await ctx.runQuery(internal.loyalty.authorize, { token: a.token });
    if (a.password.length < 8 || a.password.length > 200)
      fail("Use a password of 8–200 characters");
    await ctx.runMutation(internal.loyalty.configureSharedStaff, {
      hash: await hashPassword(a.password),
      displaySecret: await encryptCredential(a.password, "staff"),
    });
  },
});
export const configureSharedStaff = internalMutation({
  args: { hash: v.string(), displaySecret: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const people = await ctx.db.query("loyaltyStaff").collect();
    const shared = people.find((p) => p.name === "staff");
    for (const person of people) {
      if (person._id !== shared?._id)
        await ctx.db.patch(person._id, { active: false });
      for (const session of await ctx.db
        .query("loyaltySessions")
        .withIndex("by_staff", (q) => q.eq("staffId", person._id))
        .collect())
        await ctx.db.delete(session._id);
    }
    if (shared)
      await ctx.db.patch(shared._id, {
        hash: a.hash,
        displaySecret: a.displaySecret,
        active: true,
        role: "staff",
      });
    else
      await ctx.db.insert("loyaltyStaff", {
        name: "staff",
        hash: a.hash,
        displaySecret: a.displaySecret,
        active: true,
        role: "staff",
      });
    await ctx.db.insert("loyaltyAudit", {
      actor: "administrator",
      event: "staff.shared_password_changed",
      detail:
        "Shared scanner access updated; previous scanner sessions revoked",
      at: Date.now(),
    });
  },
});

export const statistics = query({
  args: {
    token: v.string(),
    programId: v.optional(v.id("loyaltyPrograms")),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, a) => {
    await staff(ctx, a.token, true);
    if (
      !Number.isFinite(a.from) ||
      !Number.isFinite(a.to) ||
      a.from > a.to ||
      a.to - a.from > 366 * 86400000
    )
      fail("Choose up to one year");
    const selected = (id: Id<"loyaltyPrograms">) =>
      !a.programId || id === a.programId;
    const programs = await ctx.db.query("loyaltyPrograms").collect();
    const members = await ctx.db.query("loyaltyMembers").collect();
    const balances = await ctx.db.query("loyaltyBalances").collect();
    const ledger = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_at", (q) => q.gte("at", a.from).lte("at", a.to))
      .collect();
    const rewards = await ctx.db
      .query("loyaltyRewards")
      .withIndex("by_earned", (q) =>
        q.gte("earnedAt", a.from).lte("earnedAt", a.to),
      )
      .collect();
    const key = (at: number) =>
      new Date(at + 14400000).toISOString().slice(0, 10);
    const daily = new Map<
      string,
      { date: string; cards: number; stamps: number; gifts: number }
    >();
    for (let at = a.from; at <= a.to; at += 86400000) {
      const date = key(at);
      daily.set(date, { date, cards: 0, stamps: 0, gifts: 0 });
    }
    const rows = programs.map((p) => ({
      id: p._id,
      name: p.name,
      names: p.rewardNames,
      cards: 0,
      stamps: 0,
      gifts: 0,
    }));
    // First program balance is the card's issue event; system welcome stamps are excluded.
    for (const balance of balances) {
      if (
        !selected(balance.programId) ||
        balance._creationTime < a.from ||
        balance._creationTime > a.to
      )
        continue;
      const row = rows.find((r) => r.id === balance.programId);
      if (row) row.cards++;
    }
    const issued = a.programId
      ? balances
          .filter((b) => selected(b.programId))
          .map((b) => ({ _creationTime: b._creationTime }))
      : members;
    for (const m of issued)
      if (m._creationTime >= a.from && m._creationTime <= a.to) {
        const day = daily.get(key(m._creationTime));
        if (day) day.cards++;
      }
    for (const entry of ledger) {
      if (
        !selected(entry.programId) ||
        entry.actor === "system" ||
        entry.key.startsWith("welcome:") ||
        entry.kind !== "award"
      )
        continue;
      const day = daily.get(key(entry.at));
      if (day) day.stamps += entry.count;
      const row = rows.find((r) => r.id === entry.programId);
      if (row) row.stamps += entry.count;
    }
    const gifts: {
      programId: Id<"loyaltyPrograms">;
      name: string;
      item: string;
      count: number;
    }[] = [];
    for (const reward of rewards) {
      if (!selected(reward.programId)) continue;
      const day = daily.get(key(reward.earnedAt));
      if (day) day.gifts++;
      const row = rows.find((r) => r.id === reward.programId);
      if (row) row.gifts++;
      const group = gifts.find(
        (g) => g.programId === reward.programId && g.item === reward.label,
      );
      if (group) group.count++;
      else
        gifts.push({
          programId: reward.programId,
          name: row?.name ?? "",
          item: reward.label,
          count: 1,
        });
    }
    const days = [...daily.values()];
    return {
      days,
      cards: days.reduce((n, d) => n + d.cards, 0),
      stamps: days.reduce((n, d) => n + d.stamps, 0),
      gifts: days.reduce((n, d) => n + d.gifts, 0),
      breakdown: gifts,
      programs: rows.filter((r) => selected(r.id)),
    };
  },
});

export const setPoints = mutation({
  args: {
    token: v.string(),
    qr: v.string(),
    programId: v.id("loyaltyPrograms"),
    points: v.number(),
    key: v.string(),
  },
  handler: async (ctx, a) => {
    const actor = await staff(ctx, a.token, true),
      m = await member(ctx, a.qr);
    clean(a.key, 100);
    const prior = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_key", (q) => q.eq("key", a.key))
      .unique();
    if (prior) {
      if (
        prior.memberId !== m._id ||
        prior.programId !== a.programId ||
        prior.kind !== "adjust" ||
        prior.reference !== `Set points: ${a.points}`
      )
        fail("Transaction key was already used");
      return;
    }
    await expireMember(ctx, m._id);
    const p = await ctx.db.get(a.programId);
    if (!p) fail("Program missing");
    const b = await ctx.db
      .query("loyaltyBalances")
      .withIndex("by_pair", (q) =>
        q.eq("memberId", m._id).eq("programId", p._id),
      )
      .unique();
    const rules = b
      ? await ctx.db.get(b.versionId)
      : await ctx.db
          .query("loyaltyVersions")
          .withIndex("by_program", (q) =>
            q.eq("programId", p._id).eq("version", p.version),
          )
          .unique();
    if (
      !rules ||
      !Number.isInteger(a.points) ||
      a.points < 0 ||
      a.points > rules.threshold
    )
      fail("Invalid points");
    const now = Date.now();
    if (a.points > 0 && expired(p.endsAt, now)) fail("Card has expired");
    const complete = a.points === rules.threshold,
      stamps = complete ? 0 : a.points;
    const expiresAt =
      stamps === 0
        ? undefined
        : rules.expiry === "campaign"
          ? rules.campaignEndAt
          : (b?.expiresAt ??
            (rules.expiry === "never"
              ? undefined
              : calendarMonths(now, rules.months)));
    const values = {
      memberId: m._id,
      programId: p._id,
      versionId: rules._id,
      stamps,
      expiresAt,
    };
    const balanceId = b
      ? b._id
      : await ctx.db.insert("loyaltyBalances", values);
    if (b) await ctx.db.patch(b._id, values);
    if (rules.expiry === "fixed") {
      for (const lot of await ctx.db
        .query("loyaltyLots")
        .withIndex("by_balance", (q) => q.eq("balanceId", balanceId))
        .collect())
        await ctx.db.delete(lot._id);
      if (stamps)
        await ctx.db.insert("loyaltyLots", {
          balanceId,
          remaining: stamps,
          expiresAt: expiresAt!,
          key: a.key,
        });
    }
    if (complete) {
      await ctx.db.insert("loyaltyRewards", {
        memberId: m._id,
        programId: p._id,
        versionId: rules._id,
        label: rules.reward,
        status: "available",
        earnedAt: now,
        expiresAt: rules.rewardDays
          ? Math.min(now + rules.rewardDays * 86400000, p.endsAt ?? Infinity)
          : p.endsAt,
      });
      await increment(ctx, { rewardsEarned: 1 });
    }
    await ctx.db.insert("loyaltyLedger", {
      memberId: m._id,
      programId: p._id,
      kind: "adjust",
      count: a.points - (b?.stamps ?? 0),
      at: now,
      actor,
      key: a.key,
      reference: `Set points: ${a.points}`,
    });
    await ctx.db.insert("loyaltyAudit", {
      actor,
      event: "card.points",
      detail: `${m._id}: ${b?.stamps ?? 0} → ${a.points}`,
      at: now,
    });
    await touchCard(ctx, m._id);
  },
});

export const credentialRecords = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    await staff(ctx, a.token, true);
    const shared = await ctx.db
      .query("loyaltyStaff")
      .withIndex("by_name", (q) => q.eq("name", "staff"))
      .unique();
    const pin = await ctx.db.query("loyaltySignupSettings").first();
    return { staff: shared?.active ? shared : null, pin };
  },
});
export const currentCredentials = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    a,
  ): Promise<{ staffPassword: string | null; pin: string | null }> => {
    const records = await ctx.runQuery(internal.loyalty.credentialRecords, a);
    return {
      staffPassword: await decryptCredential(
        records.staff?.displaySecret,
        "staff",
      ),
      pin: await decryptCredential(records.pin?.displaySecret, "pin"),
    };
  },
});

export const staffActivity = query({
  args: {
    token: v.string(),
    kind: v.union(v.literal("history"), v.literal("rewards")),
  },
  handler: async (ctx, a) => {
    const person = await staff(ctx, a.token),
      actor = person === "administrator" ? "staff" : person;
    const entries =
      a.kind === "rewards"
        ? await ctx.db
            .query("loyaltyLedger")
            .withIndex("by_actor_reward_at", (q) =>
              q.eq("actor", actor).eq("earnedReward", true),
            )
            .order("desc")
            .take(50)
        : await ctx.db
            .query("loyaltyLedger")
            .withIndex("by_actor_kind_at", (q) =>
              q.eq("actor", actor).eq("kind", "award"),
            )
            .order("desc")
            .take(50);
    return Promise.all(
      entries.map(async (entry) => {
        const [member, program, rewards] = await Promise.all([
          ctx.db.get(entry.memberId),
          ctx.db.get(entry.programId),
          issuedRewards(ctx, entry.rewardIds ?? []),
        ]);
        return {
          id: entry._id,
          at: entry.at,
          code: member?.publicCode ?? member?.qr ?? null,
          revoked: member?.revoked ?? true,
          points: entry.count,
          reversed: !!entry.reversedBy,
          program: program?.name ?? "",
          names: program?.rewardNames,
          rewards,
        };
      }),
    );
  },
});
export const backfillStaffRewardLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    for (const entry of await ctx.db.query("loyaltyLedger").collect()) {
      if (
        entry.kind !== "award" ||
        entry.actor === "system" ||
        entry.earnedReward !== undefined
      )
        continue;
      const rewards = (
        await ctx.db
          .query("loyaltyRewards")
          .withIndex("by_member", (q) => q.eq("memberId", entry.memberId))
          .collect()
      ).filter(
        (r) => r.programId === entry.programId && r.earnedAt === entry.at,
      );
      await ctx.db.patch(entry._id, {
        rewardIds: rewards.map((r) => r._id),
        earnedReward: rewards.length > 0,
      });
      updated++;
    }
    return updated;
  },
});

export const scannerSession = query({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    const session = await ctx.db
      .query("loyaltySessions")
      .withIndex("by_token", (q) => q.eq("token", a.token))
      .unique();
    if (!session || session.expiresAt <= Date.now()) return null;
    const person = await ctx.db.get(session.staffId);
    return person?.active ? { expiresAt: session.expiresAt } : null;
  },
});
