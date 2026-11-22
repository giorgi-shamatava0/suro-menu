import { expect, test } from "vitest";
import { sameOrigin } from "../lib/loyalty/origin";
import { customerLanguage } from "../lib/loyalty/customer-copy";
test("direct and phone LAN origins are accepted", () => {
  expect(
    sameOrigin(
      new Request("http://localhost:3011/api/loyalty/enroll", {
        headers: { origin: "http://localhost:3011" },
      }),
    ),
  ).toBe(true);
  expect(
    sameOrigin(
      new Request("http://localhost:3011/api/loyalty/enroll", {
        headers: {
          origin: "http://192.168.1.50:3011",
          host: "192.168.1.50:3011",
        },
      }),
    ),
  ).toBe(true);
});
test("forwarded HTTPS host is accepted without trusting an unrelated origin", () => {
  const headers = {
    host: "localhost:3011",
    "x-forwarded-host": "preview.example.com",
    "x-forwarded-proto": "https",
  };
  expect(
    sameOrigin(
      new Request("http://localhost:3011/api/loyalty/enroll", {
        headers: { ...headers, origin: "https://preview.example.com" },
      }),
    ),
  ).toBe(true);
  expect(
    sameOrigin(
      new Request("http://localhost:3011/api/loyalty/enroll", {
        headers: { ...headers, origin: "https://attacker.example.com" },
      }),
    ),
  ).toBe(false);
});
test("missing, null, malformed, other-port and cross-origin requests are rejected", () => {
  for (const origin of [
    undefined,
    "null",
    "oops",
    "http://localhost:9999",
    "https://attacker.test",
    "http://localhost:3011/path",
  ]) {
    expect(
      sameOrigin(
        new Request("http://localhost:3011/api/loyalty/enroll", {
          headers: { host: "localhost:3011", ...(origin ? { origin } : {}) },
        }),
      ),
    ).toBe(false);
  }
});
test("Georgian is the default and menu language choices are respected", () => {
  expect(customerLanguage()).toBe("ka");
  expect(customerLanguage("fr")).toBe("ka");
  expect(customerLanguage("en")).toBe("en");
  expect(customerLanguage("ru")).toBe("ru");
});
