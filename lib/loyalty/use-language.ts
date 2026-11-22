"use client";
import { useEffect, useState } from "react";
import { customerLanguage, type CustomerLanguage } from "./customer-copy";
export function useCustomerLanguage(initial: CustomerLanguage) {
  const [language, setLanguage] = useState(initial);
  useEffect(() => {
    const change = (event: Event) =>
      setLanguage(customerLanguage((event as CustomEvent<string>).detail));
    window.addEventListener("suro:language", change);
    return () => window.removeEventListener("suro:language", change);
  }, []);
  return language;
}
