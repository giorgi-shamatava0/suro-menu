import { LoyaltyCardSample } from "@/app/(loyalty)/loyalty/RewardCard";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
export function AdminCard({
  lang,
  threshold,
  stamps,
  reward,
}: {
  lang: CustomerLanguage;
  threshold: number;
  stamps: number;
  reward: string;
}) {
  const t = customerCopy[lang];
  return (
    <LoyaltyCardSample
      lang={lang}
      title={t.cardHeading}
      name={reward}
      stamps={stamps}
      threshold={threshold}
    />
  );
}
