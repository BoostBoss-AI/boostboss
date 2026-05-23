/**
 * Boost Boss — Lumi Web SDK test (Door 2: JS Snippet).
 * Run: node tests/lumi.test.js
 *
 * public/lumi.js is browser code, so this harness installs a minimal DOM /
 * fetch / Image stub before loading it. The stub is deliberately shallow —
 * enough for every placement renderer to run without throwing — so we can
 * assert engine behaviour: the core-matrix slot taxonomy, request shape
 * (surface + X-Lumi-Source + context), legacy-slot fallback, and the
 * context-joined feedback beacons (impression / click / dismiss) that
 * lumi.js previously did not fire.
 */

const assert = require("assert");
const path   = require("path");

// ── Captured side effects ───────────────────────────────────────────────
let BEACONS = [];        // every tracking pixel URL fired
let EVENTS  = [];        // every window CustomEvent dispatched
let LAST_REQUEST = null; // { url, headers, body }
let MOCK = { ok: true, payload: null };

// ── Minimal DOM stub ────────────────────────────────────────────────────
function Element() {}
function makeEl(tag) {
  const el = new Element();
  el.tagName = String(tag || "div").toUpperCase();
  el.nodeType = 1;
  el.children = [];
  el.parentNode = null;
  el._handlers = {};
  el._attrs = {};
  el._cls = new Set();
  el._className = "";
  el._innerHTML = "";
  el.style = { setProperty() {}, cssText: "" };
  el.classList = {
    add() { for (const c of arguments) el._cls.add(c); },
    remove() { for (const c of arguments) el._cls.delete(c); },
    contains(c) { return el._cls.has(c); },
  };
  Object.defineProperty(el, "className", {
    get() { return el._className; }, set(v) { el._className = v; },
  });
  Object.defineProperty(el, "innerHTML", {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = v; if (v === "") el.children = []; },
  });
  el.setAttribute = (k, v) => { el._attrs[k] = String(v); };
  el.getAttribute = (k) => (el._attrs[k] === undefined ? null : el._attrs[k]);
  el.matches = (sel) => sel === "[data-lumi-slot]" && el._attrs["data-lumi-slot"] != null;
  el.appendChild = (c) => { el.children.push(c); c.parentNode = el; return c; };
  el.removeChild = (c) => {
    const i = el.children.indexOf(c);
    if (i >= 0) el.children.splice(i, 1);
    c.parentNode = null; return c;
  };
  el.remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.querySelector = () => null;
  el.querySelectorAll = () => [];
  el.addEventListener = (ev, fn) => { (el._handlers[ev] = el._handlers[ev] || []).push(fn); };
  el._fire = (ev) => { (el._handlers[ev] || []).forEach((fn) => fn({ preventDefault() {} })); };
  return el;
}

// Recursively find the first descendant whose className contains `cls`.
function findByClass(el, cls) {
  for (const c of el.children || []) {
    if (c.className && c.className.indexOf(cls) >= 0) return c;
    const deep = findByClass(c, cls);
    if (deep) return deep;
  }
  return null;
}

function installGlobals() {
  const doc = {
    readyState: "complete",
    title: "",
    head: makeEl("head"),
    body: makeEl("body"),
    currentScript: { getAttribute: (k) => (k === "data-publisher-id" ? "pub_test_demo" : null) },
    createElement: (t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: t }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  global.Element = Element;
  global.window = {
    dispatchEvent: (e) => { EVENTS.push(e); return true; },
  };
  global.document = doc;
  global.location = { pathname: "/test" };
  global.navigator = { language: "en-US" };
  global.CustomEvent = function (type, opts) { this.type = type; this.detail = opts && opts.detail; };
  global.MutationObserver = function () { this.observe = function () {}; this.disconnect = function () {}; };
  global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
  global.Image = function () {
    this.style = {};
    Object.defineProperty(this, "src", { set(v) { BEACONS.push(v); } });
  };
  global.fetch = function (url, opts) {
    LAST_REQUEST = { url, headers: (opts && opts.headers) || {}, body: (opts && opts.body) || null };
    if (!MOCK.ok) return Promise.resolve({ ok: false, status: 500 });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        jsonrpc: "2.0",
        result: { content: [{ text: JSON.stringify(MOCK.payload) }] },
      }),
    });
  };
}

const LUMI_PATH = path.resolve(__dirname, "../public/lumi.js");
function loadLumi() {
  delete require.cache[LUMI_PATH];
  BEACONS = []; EVENTS = []; LAST_REQUEST = null;
  global.window.Lumi = undefined;
  require(LUMI_PATH);
  return global.window.Lumi;
}

// Auction payload, mirroring api/mcp.js — tracking URLs carry the ctx= fingerprint.
function adPayload() {
  return {
    sponsored: {
      campaign_id: "cmp_test", type: "native",
      headline: "Try Acme CRM", subtext: "Built for small sales teams.",
      media_url: null, cta_label: "Start free", cta_url: "https://acme.example/crm",
      disclosure_label: "Sponsored",
      tracking: {
        impression: "https://boostboss.ai/api/track?event=impression&ctx=ctx_abc",
        click:      "https://boostboss.ai/api/track?event=click&ctx=ctx_abc",
        close:      "https://boostboss.ai/api/track?event=close&ctx=ctx_abc",
        dismiss:    "https://boostboss.ai/api/track?event=dismiss&ctx=ctx_abc",
      },
    },
    auction: { auction_id: "auc_test", sandbox: false },
  };
}

// Mount a slot and wait for the async fetch + render to settle.
async function mount(Lumi, format, context) {
  const el = makeEl("div");
  global.document.body.appendChild(el);
  Lumi.render(el, { format, context: context || "x" });
  await new Promise((r) => setTimeout(r, 10));
  return el;
}

installGlobals();

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("Lumi Web SDK (lumi.js) · placement-engine test\n");

  await test("version is 0.2.0 and the API is exposed", () => {
    const Lumi = loadLumi();
    assert.strictEqual(Lumi.version, "0.2.0");
    ["refresh", "destroy", "render", "trackConversion", "getLastError"].forEach((m) =>
      assert.strictEqual(typeof Lumi[m], "function", m + " exposed"));
  });

  // ── Request shape ──────────────────────────────────────────────────
  await test("request carries context, web-<placement> surface, X-Lumi-Source", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    await mount(Lumi, "card", "comparing CRM tools");
    assert.strictEqual(LAST_REQUEST.headers["X-Lumi-Source"], "js-snippet");
    const args = JSON.parse(LAST_REQUEST.body).params.arguments;
    assert.strictEqual(args.context_summary, "comparing CRM tools");
    assert.strictEqual(args.surface, "web-card");
  });

  // ── Rendering + context-joined feedback ────────────────────────────
  await test("card renders and fires a context-joined impression beacon", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "card");
    assert.ok(findByClass(el, "lumi-cardbox__title"), "card title rendered");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u) && /ctx=ctx_abc/.test(u)),
      "impression beacon fired with the context fingerprint");
  });

  await test("card CLICK fires a context-joined click beacon (the old gap)", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "card");
    const cta = findByClass(el, "lumi-cta");
    assert.ok(cta, "CTA rendered");
    cta._fire("click");
    assert.ok(BEACONS.some((u) => /event=click/.test(u) && /ctx=ctx_abc/.test(u)),
      "click beacon fired server-side — lumi.js previously only dispatched a window event");
  });

  await test("card DISMISS fires a dismiss beacon and clears the slot", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "card");
    const x = findByClass(el, "lumi-x");
    assert.ok(x, "dismiss control rendered");
    x._fire("click");
    assert.ok(BEACONS.some((u) => /event=dismiss/.test(u)), "dismiss beacon fired");
  });

  await test("citation renders inline and its link fires a click beacon", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "citation");
    assert.ok(findByClass(el, "lumi-citation__title"), "citation rendered");
    findByClass(el, "lumi-cta")._fire("click");
    assert.ok(BEACONS.some((u) => /event=click/.test(u)));
  });

  await test("chip renders a pill and fires impression + click", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "chip");
    const chip = findByClass(el, "lumi-chip");
    assert.ok(chip, "chip rendered");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u)), "impression fired");
    chip._fire("click");
    assert.ok(BEACONS.some((u) => /event=click/.test(u)), "click fired");
  });

  await test("loading ad renders a shimmer card with a link CTA", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "loading");
    assert.ok(el.classList.contains("lumi-loading"), "loading class applied");
    assert.ok(findByClass(el, "lumi-loading__title"), "loading headline rendered");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u)));
  });

  await test("corner self-mounts a fixed anchor to the body", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    await mount(Lumi, "corner");
    const anchor = findByClass(global.document.body, "lumi-corner-anchor");
    assert.ok(anchor, "corner anchor mounted to body");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u)));
  });

  // ── Legacy slot fallback ───────────────────────────────────────────
  await test("legacy 'banner' slot still resolves (→ card)", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    const el = await mount(Lumi, "banner");
    assert.ok(el.classList.contains("lumi-cardbox"), "legacy banner falls back to card");
  });

  await test("legacy 'interstitial' slot still resolves (→ corner)", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: adPayload() };
    await mount(Lumi, "interstitial");
    assert.ok(findByClass(global.document.body, "lumi-corner-anchor"),
      "legacy interstitial falls back to corner");
  });

  // ── No-fill ────────────────────────────────────────────────────────
  await test("no-fill dispatches lumi:no_fill and renders nothing", async () => {
    const Lumi = loadLumi();
    MOCK = { ok: true, payload: { sponsored: null, reason: "no_campaigns" } };
    const el = await mount(Lumi, "card");
    assert.ok(EVENTS.some((e) => e.type === "lumi:no_fill"), "no_fill event dispatched");
    assert.strictEqual(el.children.length, 0, "slot left empty");
  });

  console.log("\n" + (failed === 0
    ? "\x1b[32mAll " + passed + " lumi.js tests passed.\x1b[0m"
    : "\x1b[31m" + failed + " failed, " + passed + " passed.\x1b[0m"));
  process.exit(failed === 0 ? 0 : 1);
})();
