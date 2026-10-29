"use server";

import { updateTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Called by /admin after its saves: only a live admin session may refresh the public menu.
export async function publishMenu(token: string) {
  if (!(await fetchQuery(api.auth.check, { token }))) throw new Error("unauthorized");
  updateTag("menu");
}
