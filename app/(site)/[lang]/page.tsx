import type { Lang } from "@/lib/i18n";
import { renderMenu } from "./render";

export default async function Page({ params }: PageProps<"/[lang]">) {
  return renderMenu((await params).lang as Lang);
}
