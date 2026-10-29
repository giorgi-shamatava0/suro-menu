import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./auth";
import { snapshot, type Snapshot } from "./menu";
import { categoryFields, itemFields, sectionFields, settingsFields } from "./schema";

// Every function here takes the session token from /admin and checks it first.
const token = v.string();
const { order: _s, ...sectionData } = sectionFields;
const { order: _c, ...categoryData } = categoryFields;
const { order: _i, ...itemData } = itemFields;

// Marks the draft as different from the site. Writes only on the first edit, so the versions query isn't re-run on every keystroke.
async function edited(ctx: MutationCtx, dirty = true) {
  const row = await ctx.db.query("draftState").first();
  if (!row) await ctx.db.insert("draftState", { dirty });
  else if (row.dirty !== dirty) await ctx.db.patch(row._id, { dirty });
}

export const tree = query({
  args: { token },
  handler: async (ctx, a) => {
    await requireAdmin(ctx, a.token);
    const sections = await ctx.db.query("sections").withIndex("by_order").collect();
    const categories = (await ctx.db.query("categories").collect()).sort((x, y) => x.order - y.order);
    const items = await Promise.all(
      (await ctx.db.query("items").collect())
        .sort((x, y) => x.order - y.order)
        .map(async (i) => ({ ...i, photoUrl: i.photo ? await ctx.storage.getUrl(i.photo) : null })),
    );
    return { sections, categories, items, settings: await ctx.db.query("settings").first() };
  },
});

// Whole-document saves: the editor always sends the full record, so a field left out is cleared.
export const saveSection = mutation({
  args: { token, id: v.optional(v.id("sections")), data: v.object(sectionData) },
  handler: async (ctx, { token, id, data }) => {
    await requireAdmin(ctx, token);
    await edited(ctx);
    if (id) {
      const old = await ctx.db.get(id);
      if (!old) throw new ConvexError("not found");
      await ctx.db.replace(id, { ...data, order: old.order });
      return id;
    }
    const last = await ctx.db.query("sections").withIndex("by_order").order("desc").first();
    return ctx.db.insert("sections", { ...data, order: (last?.order ?? 0) + 1 });
  },
});

export const saveCategory = mutation({
  args: { token, id: v.optional(v.id("categories")), data: v.object(categoryData) },
  handler: async (ctx, { token, id, data }) => {
    await requireAdmin(ctx, token);
    await edited(ctx);
    const next = async () => ((await ctx.db.query("categories").withIndex("by_section", (q) => q.eq("sectionId", data.sectionId)).order("desc").first())?.order ?? 0) + 1;
    if (id) {
      const old = await ctx.db.get(id);
      if (!old) throw new ConvexError("not found");
      await ctx.db.replace(id, { ...data, order: old.sectionId !== data.sectionId ? await next() : old.order });
      return id;
    }
    return ctx.db.insert("categories", { ...data, order: await next() });
  },
});

export const saveItem = mutation({
  args: { token, id: v.optional(v.id("items")), data: v.object(itemData) },
  handler: async (ctx, { token, id, data }) => {
    await requireAdmin(ctx, token);
    if (!Object.values(data.name).some((s) => s?.trim())) throw new ConvexError("An item needs a name in at least one language");
    await edited(ctx);
    const next = async () => ((await ctx.db.query("items").withIndex("by_category", (q) => q.eq("categoryId", data.categoryId)).order("desc").first())?.order ?? 0) + 1;
    if (id) {
      const old = await ctx.db.get(id);
      if (!old) throw new ConvexError("not found");
      await ctx.db.replace(id, { ...data, order: old.categoryId !== data.categoryId ? await next() : old.order });
      return id;
    }
    return ctx.db.insert("items", { ...data, order: await next() });
  },
});

export const saveSettings = mutation({
  args: { token, data: v.object(settingsFields) },
  handler: async (ctx, { token, data }) => {
    await requireAdmin(ctx, token);
    // the map link becomes an <a href> on the public page
    if (data.mapUrl && !/^https:\/\//i.test(data.mapUrl)) throw new ConvexError("The map link must start with https://");
    await edited(ctx);
    const row = await ctx.db.query("settings").first();
    if (row) await ctx.db.replace(row._id, data);
    else await ctx.db.insert("settings", data);
  },
});

// A section takes its categories and dishes with it, a category its dishes. Deleting twice (a double click) is a no-op.
export const remove = mutation({
  args: { token, id: v.union(v.id("sections"), v.id("categories"), v.id("items")) },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    if (!(await ctx.db.get(id))) return;
    await edited(ctx);
    const table = ctx.db.normalizeId("sections", id) ? "sections" : ctx.db.normalizeId("categories", id) ? "categories" : "items";
    const cats = table === "sections" ? await ctx.db.query("categories").withIndex("by_section", (q) => q.eq("sectionId", id as never)).collect() : [];
    const catIds = table === "categories" ? [id as Id<"categories">] : cats.map((c) => c._id);
    for (const c of catIds) for (const it of await ctx.db.query("items").withIndex("by_category", (q) => q.eq("categoryId", c)).collect()) await ctx.db.delete(it._id);
    for (const c of cats) await ctx.db.delete(c._id);
    // shortcut: photos are never deleted from storage, because saved versions may still show them; prune by hand if storage ever matters
    await ctx.db.delete(id);
  },
});

// ids in their new order; all must be siblings of the same table.
export const reorder = mutation({
  args: { token, ids: v.union(v.array(v.id("sections")), v.array(v.id("categories")), v.array(v.id("items"))) },
  handler: async (ctx, { token, ids }) => {
    await requireAdmin(ctx, token);
    await edited(ctx);
    await Promise.all(ids.map((id, order) => ctx.db.patch(id, { order })));
  },
});

// One photo size for every dish in a category.
export const setDisplay = mutation({
  args: { token, categoryId: v.id("categories"), display: itemFields.display },
  handler: async (ctx, { token, categoryId, display }) => {
    await requireAdmin(ctx, token);
    await edited(ctx);
    const items = await ctx.db.query("items").withIndex("by_category", (q) => q.eq("categoryId", categoryId)).collect();
    await Promise.all(items.filter((it) => it.display !== display).map((it) => ctx.db.patch(it._id, { display })));
  },
});

export const uploadUrl = mutation({
  args: { token },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    return ctx.storage.generateUploadUrl();
  },
});

const SLOTS = 5;
// Key order is not guaranteed after a round trip, so compare with sorted keys.
const canon = (x: unknown) => JSON.stringify(x, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
const slotArg = v.number();
const checkSlot = (slot: number) => { if (!Number.isInteger(slot) || slot < 1 || slot > SLOTS) throw new ConvexError(`Pick a slot from 1 to ${SLOTS}`); };

export const versions = query({
  args: { token },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    const pub = await ctx.db.query("published").first();
    const dishes = (d: Snapshot) => d.sections.reduce((n, s) => n + s.categories.reduce((m, c) => m + c.items.length, 0), 0);
    const slots = (await ctx.db.query("versions").collect()).map((r) => ({ slot: r.slot, at: r.at, name: r.name, dishes: dishes(r.data) })).sort((a, b) => a.slot - b.slot);
    // the full comparison only runs once, on a deployment that has no draftState row yet
    const state = await ctx.db.query("draftState").first();
    const changed = state ? state.dirty : !pub || canon(await snapshot(ctx)) !== canon(pub.data);
    return { live: pub?.slot ?? null, liveAt: pub?.at ?? null, changed, slots };
  },
});

// The draft goes live and is kept in a slot (overwriting what was there).
export const publish = mutation({
  args: { token, slot: slotArg },
  handler: async (ctx, { token, slot }) => {
    await requireAdmin(ctx, token);
    checkSlot(slot);
    const data = await snapshot(ctx);
    const at = Date.now();
    const pub = await ctx.db.query("published").first();
    if (pub) await ctx.db.replace(pub._id, { data, at, slot });
    else await ctx.db.insert("published", { data, at, slot });
    const old = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (old) await ctx.db.replace(old._id, { slot, data, at });
    else await ctx.db.insert("versions", { slot, data, at });
    await edited(ctx, false);
  },
});

// A saved version goes on the site as it is; the draft is not touched.
export const publishVersion = mutation({
  args: { token, slot: slotArg },
  handler: async (ctx, { token, slot }) => {
    await requireAdmin(ctx, token);
    const row = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (!row) throw new ConvexError("That slot is empty");
    const pub = await ctx.db.query("published").first();
    const live = { data: row.data, at: Date.now(), slot };
    if (pub) await ctx.db.replace(pub._id, live);
    else await ctx.db.insert("published", live);
    await edited(ctx, canon(await snapshot(ctx)) !== canon(row.data));
  },
});

// A saved version goes away; the one on the site can't (guests would lose the menu they see).
export const removeVersion = mutation({
  args: { token, slot: slotArg },
  handler: async (ctx, { token, slot }) => {
    await requireAdmin(ctx, token);
    const pub = await ctx.db.query("published").first();
    if (pub?.slot === slot) throw new ConvexError("This version is on the site. Publish another one first.");
    const row = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

// Start a new menu from scratch: the draft's sections, categories and dishes go; café info, versions and the site stay.
export const clearDraft = mutation({
  args: { token },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    for (const t of ["items", "categories", "sections"] as const) for (const d of await ctx.db.query(t).collect()) await ctx.db.delete(d._id);
    await edited(ctx);
  },
});

// The owner's own label for a saved version ("Summer menu"); empty clears it. A new publish into the slot clears it too.
export const nameVersion = mutation({
  args: { token, slot: slotArg, name: v.string() },
  handler: async (ctx, { token, slot, name }) => {
    await requireAdmin(ctx, token);
    const row = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (!row) throw new ConvexError("That slot is empty");
    await ctx.db.patch(row._id, { name: name.trim().slice(0, 60) || undefined });
  },
});

// One saved version shaped like `tree`, so the editor can show it read-only without touching the draft.
export const version = query({
  args: { token, slot: slotArg },
  handler: async (ctx, { token, slot }) => {
    await requireAdmin(ctx, token);
    const row = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (!row) return null;
    const { sections, settings } = row.data as Snapshot;
    const out = { sections: [] as object[], categories: [] as object[], items: [] as object[], settings: { _id: "", _creationTime: 0, ...settings } };
    for (const [si, { categories, ...s }] of sections.entries()) {
      out.sections.push({ ...s, order: si });
      for (const [ci, { items, ...c }] of categories.entries()) {
        out.categories.push({ ...c, sectionId: s._id, order: ci });
        for (const [ii, i] of items.entries()) out.items.push({ ...i, categoryId: c._id, order: ii, photoUrl: i.photo ? await ctx.storage.getUrl(i.photo) : null });
      }
    }
    return out;
  },
});

// A saved version replaces the draft (guests keep seeing the published menu until the next publish).
export const restore = mutation({
  args: { token, slot: slotArg },
  handler: async (ctx, { token, slot }) => {
    await requireAdmin(ctx, token);
    const row = await ctx.db.query("versions").withIndex("by_slot", (q) => q.eq("slot", slot)).unique();
    if (!row) throw new ConvexError("That slot is empty");
    const { sections, settings } = row.data as Snapshot;
    for (const t of ["items", "categories", "sections"] as const) for (const d of await ctx.db.query(t).collect()) await ctx.db.delete(d._id);
    for (const [si, { _id, categories, ...s }] of sections.entries()) {
      const sectionId = await ctx.db.insert("sections", { ...s, order: si });
      for (const [ci, { _id, items, ...c }] of categories.entries()) {
        const categoryId = await ctx.db.insert("categories", { ...c, sectionId, order: ci });
        for (const [ii, { _id, ...i }] of items.entries()) await ctx.db.insert("items", { ...i, categoryId, order: ii });
      }
    }
    const cur = await ctx.db.query("settings").first();
    if (cur) await ctx.db.replace(cur._id, settings);
    else await ctx.db.insert("settings", settings);
    // the live version's slot always holds exactly what is live
    await edited(ctx, (await ctx.db.query("published").first())?.slot !== slot);
  },
});
