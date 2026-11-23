import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Every user-facing string is { ka?, en?, ru? }; the site falls back ka → en → ru.
export const tr = v.object({ ka: v.optional(v.string()), en: v.optional(v.string()), ru: v.optional(v.string()) });

export const sectionFields = {
  name: tr,
  decor: v.optional(v.string()), // botanical plate key, see lib/decor.ts
  titleSize: v.optional(v.union(v.literal("s"), v.literal("m"), v.literal("l"), v.literal("xl"))), // unset = Auto, see TITLE_SCALE in lib/localize.ts
  order: v.number(),
};

export const categoryFields = {
  sectionId: v.id("sections"),
  name: tr,
  note: v.optional(tr),
  compact: v.optional(v.boolean()), // short name+price list (drinks, extras)
  hidden: v.optional(v.boolean()),
  order: v.number(),
};

export const itemFields = {
  categoryId: v.id("categories"),
  name: tr,
  description: v.optional(tr),
  price: v.optional(v.number()),
  variants: v.optional(v.array(v.object({ label: tr, price: v.optional(v.number()) }))),
  portion: v.optional(v.string()), // "350 g", "0.33 l"
  kcal: v.optional(v.number()),
  allergens: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  photo: v.optional(v.id("_storage")),
  display: v.optional(v.union(v.literal("none"), v.literal("small"), v.literal("big"))), // how the photo shows; unset = small
  crop: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })), // which part shows: position in %, zoom 1-3; unset = centred
  soldOut: v.optional(v.boolean()),
  hidden: v.optional(v.boolean()),
  order: v.number(),
};

export const settingsFields = {
  tagline: v.optional(tr),
  subline: v.optional(tr),
  address: v.optional(tr),
  hours: v.optional(tr),
  opensAt: v.optional(v.string()), // "11:00", Tbilisi time
  closesAt: v.optional(v.string()),
  phone: v.optional(v.string()),
  mapUrl: v.optional(v.string()),
  instagram: v.optional(v.string()),
  note: v.optional(tr),
};

export default defineSchema({
  loyaltyMembers: defineTable({ signupDevice: v.optional(v.string()), createdAt: v.optional(v.number()), welcomeStamps: v.optional(v.number()), welcomeProgramId: v.optional(v.id("loyaltyPrograms")), consentedAt: v.optional(v.number()), consentVersion: v.optional(v.string()), publicCode: v.optional(v.string()), qr: v.string(), secret: v.string(), revoked: v.boolean(), updatedAt: v.number(), lastActiveAt: v.optional(v.number()) }).index("by_signup_device", ["signupDevice"]).index("by_active", ["lastActiveAt"]).index("by_qr", ["qr"]).index("by_public_code", ["publicCode"]).index("by_secret", ["secret"]),
  loyaltyPrograms: defineTable({ welcomeStamps: v.optional(v.number()), name: v.string(), description: v.string(), products: v.string(), reward: v.string(), rewardItemId: v.optional(v.id("items")), rewardNames: v.optional(tr), rewardImage: v.optional(v.id("_storage")), status: v.string(), version: v.number(), startsAt: v.optional(v.number()), endsAt: v.optional(v.number()) }),
  loyaltyVersions: defineTable({ programId: v.id("loyaltyPrograms"), version: v.number(), threshold: v.number(), expiry: v.string(), months: v.number(), rewardDays: v.optional(v.number()), campaignEndAt: v.optional(v.number()), reward: v.string(), rewardItemId: v.optional(v.id("items")), rewardNames: v.optional(tr), rewardImage: v.optional(v.id("_storage")) }).index("by_program", ["programId", "version"]),
  loyaltyBalances: defineTable({ memberId: v.id("loyaltyMembers"), programId: v.id("loyaltyPrograms"), versionId: v.id("loyaltyVersions"), stamps: v.number(), expiresAt: v.optional(v.number()) }).index("by_member", ["memberId"]).index("by_pair", ["memberId", "programId"]).index("by_expiry", ["expiresAt"]),
  loyaltyLots: defineTable({ balanceId: v.id("loyaltyBalances"), remaining: v.number(), expiresAt: v.number(), key: v.string() }).index("by_balance", ["balanceId", "expiresAt"]),
  loyaltyStats: defineTable({ members: v.number(), stampsIssued: v.number(), stampsExpired: v.number(), stampsReversed: v.number(), rewardsEarned: v.number(), rewardsRedeemed: v.number() }),
  loyaltyRewards: defineTable({ memberId: v.id("loyaltyMembers"), programId: v.id("loyaltyPrograms"), versionId: v.id("loyaltyVersions"), label: v.string(), status: v.string(), expiresAt: v.optional(v.number()), earnedAt: v.number(), redeemedAt: v.optional(v.number()) }).index("by_member", ["memberId"]).index("by_earned", ["earnedAt"]).index("by_expiry", ["status", "expiresAt"]),
  loyaltyLedger: defineTable({ rewardIds: v.optional(v.array(v.id("loyaltyRewards"))), earnedReward: v.optional(v.boolean()), memberId: v.id("loyaltyMembers"), programId: v.id("loyaltyPrograms"), kind: v.string(), count: v.number(), at: v.number(), actor: v.string(), key: v.string(), reference: v.string(), rewardId: v.optional(v.id("loyaltyRewards")), reversedBy: v.optional(v.id("loyaltyLedger")) }).index("by_member", ["memberId", "at"]).index("by_purchase", ["memberId", "programId", "reference", "kind"]).index("by_key", ["key"]).index("by_at", ["at"]).index("by_actor_kind_at", ["actor", "kind", "at"]).index("by_actor_reward_at", ["actor", "earnedReward", "at"]),
  loyaltyStaff: defineTable({ displaySecret: v.optional(v.string()), name: v.string(), hash: v.string(), role: v.string(), active: v.boolean() }).index("by_name", ["name"]),
  loyaltySessions: defineTable({ token: v.string(), staffId: v.id("loyaltyStaff"), expiresAt: v.number() }).index("by_token", ["token"]).index("by_staff", ["staffId"]),
  loyaltyAudit: defineTable({ actor: v.string(), event: v.string(), detail: v.string(), at: v.number() }).index("by_at", ["at"]),
  loyaltySignupSettings: defineTable({ displaySecret: v.optional(v.string()), pinDigest: v.string(), updatedAt: v.number() }),
  loyaltyLimits: defineTable({ recent: v.optional(v.array(v.number())), key: v.string(), count: v.number(), until: v.number() }).index("by_key", ["key"]),
  loyaltyOffers: defineTable({ name: v.string(), description: v.string(), eligibility: v.string(), startsAt: v.number(), endsAt: v.number(), active: v.boolean(), showOnCard: v.boolean() }),
  loyaltyBrand: defineTable({ terms: v.optional(v.object({ ka: v.string(), en: v.string(), ru: v.string() })), name: v.string(), color: v.string(), latitude: v.optional(v.number()), longitude: v.optional(v.number()) }),
  sections: defineTable(sectionFields).index("by_order", ["order"]),
  categories: defineTable(categoryFields).index("by_section", ["sectionId", "order"]),

  items: defineTable(itemFields).index("by_category", ["categoryId", "order"]),

  settings: defineTable(settingsFields),

  // what guests see (one row) and the 5 saved versions; data is a menu.snapshot()
  published: defineTable({ data: v.any(), at: v.number(), slot: v.number() }),
  versions: defineTable({ slot: v.number(), data: v.any(), at: v.number(), name: v.optional(v.string()) }).index("by_slot", ["slot"]),

  // one row: does the draft differ from what guests see? Saves flip it on, publish off (see admin.edited)
  draftState: defineTable({ dirty: v.boolean() }),

  sessions: defineTable({ token: v.string(), expiresAt: v.number() }).index("by_token", ["token"]).index("by_expiry", ["expiresAt"]),
  loginState: defineTable({ failures: v.number(), lockedUntil: v.number() }),
});

