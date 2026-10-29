import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyPassword } from "./lib/password";

const SESSION_MS = 30 * 24 * 3600_000;
const FREE_TRIES = 5;

export async function requireAdmin(ctx: QueryCtx, token: string) {
  const s = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).unique();
  if (!s || s.expiresAt < Date.now()) throw new ConvexError("unauthorized");
}

export const login = action({
  args: { password: v.string() },
  handler: async (ctx, { password }): Promise<string> => {
    if (!process.env.ADMIN_PASSWORD_HASH) throw new ConvexError("ADMIN_PASSWORD_HASH is not set on this deployment");
    // counted before the slow hash check, so a burst of parallel guesses can't all slip past the lock
    const lockedUntil = await ctx.runMutation(internal.auth.attempt, {});
    if (lockedUntil > Date.now()) throw new ConvexError({ code: "locked", until: lockedUntil });
    const ok = password.length <= 200 && (await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH));
    if (!ok) {
      const { lockedUntil: until } = await ctx.runQuery(internal.auth.state, {});
      throw new ConvexError(until > Date.now() ? { code: "locked", until } : { code: "wrong" });
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.runMutation(internal.auth.success, { token });
    return token;
  },
});

export const state = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("loginState").first()) ?? { failures: 0, lockedUntil: 0 },
});

// Global backoff: every attempt counts as a miss until it succeeds; after 5, lock 1, 2, 4 … 60 minutes.
// Returns the lock that applies to this attempt (0 = go ahead).
export const attempt = internalMutation({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("loginState").first();
    const now = Date.now();
    if (row && row.lockedUntil > now) return row.lockedUntil;
    const failures = (row?.failures ?? 0) + 1;
    const lockedUntil = failures >= FREE_TRIES ? now + Math.min(60, 2 ** (failures - FREE_TRIES)) * 60_000 : 0;
    if (row) await ctx.db.patch(row._id, { failures, lockedUntil });
    else await ctx.db.insert("loginState", { failures, lockedUntil });
    return 0;
  },
});

export const success = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const now = Date.now();
    await ctx.db.insert("sessions", { token, expiresAt: now + SESSION_MS });
    const row = await ctx.db.query("loginState").first();
    if (row) await ctx.db.patch(row._id, { failures: 0, lockedUntil: 0 });
    // old sessions would otherwise pile up forever
    for (const s of await ctx.db.query("sessions").withIndex("by_expiry", (q) => q.lt("expiresAt", now)).take(100)) await ctx.db.delete(s._id);
  },
});

export const check = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    try {
      await requireAdmin(ctx, token);
      return true;
    } catch {
      return false;
    }
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (s) await ctx.db.delete(s._id);
  },
});
