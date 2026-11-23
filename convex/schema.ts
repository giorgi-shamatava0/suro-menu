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

