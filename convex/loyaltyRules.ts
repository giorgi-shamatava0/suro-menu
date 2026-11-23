// Asia/Tbilisi has UTC+04:00 and no seasonal clock changes.
export function calendarMonths(at: number, months: number): number {
  if (!Number.isInteger(months) || months < 1 || months > 120)
    throw new Error("Invalid expiry duration");
  const local = new Date(at + 4 * 3600_000);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0),
  ).getUTCDate();
  local.setUTCDate(Math.min(day, last));
  return local.getTime() - 4 * 3600_000;
}
export function awardBalance(
  balance: number,
  count: number,
  threshold: number,
) {
  if (
    ![balance, count, threshold].every(Number.isSafeInteger) ||
    balance < 0 ||
    count < 1 ||
    count > 20 ||
    threshold < 1
  )
    throw new Error("Invalid stamp quantity");
  return {
    stamps: (balance + count) % threshold,
    rewards: Math.floor((balance + count) / threshold),
  };
}
export function expired(expiresAt: number | undefined, now: number) {
  return expiresAt !== undefined && now >= expiresAt;
}
