"use client";
import { useCustomerLanguage } from "@/lib/loyalty/use-language";
import { useEffect } from "react";
import LanguagePicker from "@/components/LanguagePicker";
import type { CustomerLanguage } from "@/lib/loyalty/customer-copy";
export default function Language({
  lang: initialLang,
}: {
  lang: CustomerLanguage;
}) {
  const lang = useCustomerLanguage(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LanguagePicker lang={lang} mode="cookie" />;
}
