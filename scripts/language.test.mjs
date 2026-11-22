import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const compiled = ts.transpileModule(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("require", "exports", compiled)(require, exports);
const { proxy } = exports;

function visit(cookie) {
  return proxy(new NextRequest("https://example.com/", {
    headers: cookie ? { cookie } : {},
  }));
}

test("a visitor's language never changes another visitor's Georgian default", () => {
  for (const language of ["en", "ru", "en", "ka"]) {
    const returning = visit(`lang=${language}`);
    assert.equal(new URL(returning.headers.get("location")).pathname, `/${language}`);
    const newcomer = visit();
    assert.equal(new URL(newcomer.headers.get("location")).pathname, "/ka");
    assert.equal(newcomer.headers.get("set-cookie"), null);
  }
  assert.equal(new URL(visit("lang=invalid").headers.get("location")).pathname, "/ka");
  const foreignBrowser = proxy(new NextRequest("https://example.com/", {
    headers: { "accept-language": "en-US,en;q=0.9" },
  }));
  assert.equal(new URL(foreignBrowser.headers.get("location")).pathname, "/ka");
});

test("language redirects cannot be stored in shared or browser caches", () => {
  for (const cookie of [undefined, "lang=en", "lang=ru"]) {
    const response = visit(cookie);
    assert.equal(response.status, 307);
    assert.match(response.headers.get("cache-control"), /private/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
  }
});
