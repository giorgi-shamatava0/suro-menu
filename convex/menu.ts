import { query, type QueryCtx } from "./_generated/server";

// The menu as the editor holds it (the draft): every row, hidden ones included, in order.
// Publish copies this into `published` (what guests see) and into one of the 5 version slots.
export async function snapshot(ctx: QueryCtx) {
  const sections = [];
  for (const { _creationTime, order, ...s } of await ctx.db.query("sections").withIndex("by_order").collect()) {
    const categories = [];
    for (const { _creationTime, order, sectionId, ...c } of await ctx.db.query("categories").withIndex("by_section", (q) => q.eq("sectionId", s._id)).collect()) {
      const items = (await ctx.db.query("items").withIndex("by_category", (q) => q.eq("categoryId", c._id)).collect()).map(({ _creationTime, order, categoryId, ...i }) => i);
      categories.push({ ...c, items });
    }
    sections.push({ ...s, categories });
  }
  const row = await ctx.db.query("settings").first();
  const settings = row ? (({ _id, _creationTime, ...r }) => r)(row) : {};
  return { sections, settings };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;

// Public, read-only: the last published menu (before the first publish, the draft). Hidden rows never leave the server.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const pub = await ctx.db.query("published").first();
    const { sections, settings } = (pub?.data as Snapshot | undefined) ?? (await snapshot(ctx));
    const out = [];
    for (const s of sections) {
      const categories = [];
      for (const c of s.categories) {
        if (c.hidden) continue;
        const items = await Promise.all(
          c.items.filter((i) => !i.hidden).map(async ({ hidden, photo, ...i }) => ({ ...i, photoUrl: photo ? await ctx.storage.getUrl(photo) : null })),
        );
        if (items.length) categories.push({ _id: c._id, name: c.name, note: c.note, compact: c.compact, items });
      }
      if (categories.length) out.push({ _id: s._id, name: s.name, decor: s.decor, categories });
    }
    return { sections: out, settings };
  },
});
