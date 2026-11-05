import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../apps/web/public/sw.js", import.meta.url), "utf8");

test("service worker retains static caching and network-only APIs with a generic offline error", async () => {
  const handlers = new Map();
  const requests = [];
  let online = true;
  const puts = [];
  const cache = { put: async (...args) => { puts.push(args); } };
  runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler) }, URL, Response,
    console: { log() {}, warn() {}, error() {} },
    caches: { match: async () => undefined, open: async () => cache },
    fetch: async (request) => { requests.push(request.url); if (!online) throw new Error("Offline"); return new Response("local response"); },
  });
  assert.equal(requests.length, 0);
  let response;
  const waits = [];
  const dispatch = (url) => handlers.get("fetch")({ request: { url, method: "GET", mode: "cors" },
    respondWith: (promise) => { response = promise; }, waitUntil: (promise) => waits.push(promise) });
  dispatch("https://editor.invalid/assets/editor.js");
  assert.equal(await (await response).text(), "local response");
  await Promise.all(waits);
  assert.equal(puts.length, 1);
  dispatch("https://editor.invalid/api/shares/example");
  assert.equal(await (await response).text(), "local response");
  assert.equal(puts.length, 1);
  online = false;
  dispatch("https://editor.invalid/api/shares/example");
  const offline = await response;
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).error, "NETWORK_UNAVAILABLE");
});
