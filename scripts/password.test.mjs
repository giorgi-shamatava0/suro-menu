import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../convex/lib/password.ts";

test("hash round-trips and rejects wrong or malformed input", async () => {
  const h = await hashPassword("correct horse battery", 1000);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("correct horse batterY", h), false);
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});
