import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarMonths,
  awardBalance,
  expired,
} from "../convex/loyaltyRules.ts";
const at = (s) => Date.parse(s + "+04:00");
test("rolling expiry uses six calendar months in Tbilisi and clamps month end", () => {
  assert.equal(
    calendarMonths(at("2026-01-01T11:00:00"), 6),
    at("2026-07-01T11:00:00"),
  );
  assert.equal(
    calendarMonths(at("2026-03-01T11:00:00"), 6),
    at("2026-09-01T11:00:00"),
  );
  assert.equal(
    calendarMonths(at("2026-08-31T23:30:00"), 6),
    at("2027-02-28T23:30:00"),
  );
  assert.equal(
    calendarMonths(at("2023-08-31T23:30:00"), 6),
    at("2024-02-29T23:30:00"),
  );
});
test("stamps expire at the precise boundary", () => {
  assert.equal(expired(100, 99), false);
  assert.equal(expired(100, 100), true);
  assert.equal(expired(undefined, 1000), false);
});
test("awards consume threshold stamps into separate entitlements", () => {
  assert.deepEqual(awardBalance(6, 4, 10), { stamps: 0, rewards: 1 });
  assert.deepEqual(awardBalance(4, 20, 5), { stamps: 4, rewards: 4 });
  assert.deepEqual(awardBalance(0, 1, 8), { stamps: 1, rewards: 0 });
});
test("invalid or fractional quantities cannot mint rewards", () => {
  for (const n of [-1, 0, 0.5, 21, Infinity, NaN])
    assert.throws(() => awardBalance(0, n, 10));
  assert.throws(() => awardBalance(0, 1, 0));
  assert.throws(() => calendarMonths(Date.now(), 0));
});
