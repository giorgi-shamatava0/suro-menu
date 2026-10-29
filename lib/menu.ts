import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Lang } from "./i18n";
import { localize } from "./localize";

// Served from the static cache; /admin saves call updateTag("menu").
async function getMenu() {
  "use cache";
  cacheTag("menu");
  cacheLife("max");
  return fetchQuery(api.menu.get, {});
}

export const getLocalMenu = async (lang: Lang) => localize(await getMenu(), lang);
export type { LocalMenu, MenuItem } from "./localize";
