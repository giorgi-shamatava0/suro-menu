import { internalMutation } from "./_generated/server";
import data from "./seedData";

// npx convex run seed:run — fills an empty deployment with the starter menu and café details.
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("sections").first()) throw new Error("Menu is not empty; refusing to seed");
    for (const [si, s] of data.entries()) {
      const sectionId = await ctx.db.insert("sections", { name: s.name, decor: s.decor, order: si });
      for (const [ci, c] of s.categories.entries()) {
        const categoryId = await ctx.db.insert("categories", { sectionId, name: c.name, compact: "compact" in c ? c.compact : undefined, order: ci });
        for (const [ii, i] of c.items.entries()) {
          await ctx.db.insert("items", {
            categoryId, name: i.name, order: ii, price: i.price, tags: [...i.tags],
            description: "description" in i ? i.description : undefined,
          });
        }
      }
    }
    if (!(await ctx.db.query("settings").first()))
      await ctx.db.insert("settings", {
        tagline: { ka: "კაფე-ბაღი გვიმრების ქვეშ", en: "A garden café under the ferns", ru: "Кафе-сад под папоротниками" },
        subline: { ka: "ცოტნე დადიანის 12, თბილისი", en: "Suro is Georgian for ivy", ru: "«Суро» по-грузински — плющ" },
        address: { ka: "ცოტნე დადიანის 12, თბილისი", en: "12 Tsotne Dadiani St, Tbilisi", ru: "ул. Цотне Дадиани, 12, Тбилиси" },
        hours: { ka: "ყოველდღე 11:00–23:00", en: "Every day 11:00–23:00", ru: "Ежедневно 11:00–23:00" },
        opensAt: "11:00",
        closesAt: "23:00",
        phone: "+995 598 33 70 20",
        mapUrl: "https://maps.app.goo.gl/Du3qVm6CtgMEgWHe9",
        note: {
          ka: "ალერგიის ან კვებითი შეზღუდვის შემთხვევაში, გთხოვთ, აცნობოთ ჩვენს პერსონალს.",
          en: "Please tell our staff about any allergies or dietary restrictions.",
          ru: "Пожалуйста, сообщите персоналу об аллергии или ограничениях в питании.",
        },
      });
  },
});

