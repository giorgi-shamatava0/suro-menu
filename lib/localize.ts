import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { pick, type Lang } from "./i18n";

// The public query's shape; the admin preview builds the same shape from its own data, plus hidden rows.
type Raw = FunctionReturnType<typeof api.menu.get>;
type Tree = FunctionReturnType<typeof api.admin.tree>;
type Flag = { hidden?: boolean };

// Resolve every translated field so the page only ever handles one language.
export function localize({ sections, settings: s }: Raw, lang: Lang) {
  const p = (t: Parameters<typeof pick>[0]) => pick(t, lang);
  return {
    settings: {
      tagline: p(s.tagline), subline: p(s.subline), address: p(s.address), hours: p(s.hours), note: p(s.note),
      opensAt: s.opensAt, closesAt: s.closesAt, phone: s.phone, mapUrl: s.mapUrl, instagram: s.instagram,
    },
    sections: sections.map((sec) => ({
      id: sec._id as string,
      name: p(sec.name),
      decor: sec.decor,
      cats: sec.categories.map((c) => ({
        id: c._id as string,
        name: p(c.name),
        note: p(c.note),
        compact: !!c.compact,
        hidden: !!(c as Flag).hidden,
        items: c.items.map((i) => ({
          id: i._id as string,
          name: p(i.name),
          desc: p(i.description),
          price: i.price,
          tags: i.tags ?? [],
          photo: i.display === "none" ? null : i.photoUrl,
          big: i.display === "big",
          soldOut: !!i.soldOut,
          hidden: !!(i as Flag).hidden,
        })),
      })),
    })),
  };
}

// The admin's flat lists in the public shape, hidden rows kept (and flagged) so the owner sees them in the preview.
export function fromTree(t: Tree): Raw {
  const { _id, _creationTime, ...settings } = t.settings ?? ({ _id: "", _creationTime: 0 } as NonNullable<Tree["settings"]>);
  return {
    settings,
    sections: t.sections.map((s) => ({
      _id: s._id, name: s.name, decor: s.decor,
      categories: t.categories.filter((c) => c.sectionId === s._id).map((c) => ({
        _id: c._id, name: c.name, note: c.note, compact: c.compact, hidden: c.hidden,
        items: t.items.filter((i) => i.categoryId === c._id).map(({ _creationTime, categoryId, order, photo, ...i }) => i),
      })),
    })),
  } as Raw;
}

export type LocalMenu = ReturnType<typeof localize>;
export type MenuItem = LocalMenu["sections"][number]["cats"][number]["items"][number];
