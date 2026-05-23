/**
 * Boost Boss — Lumi Web SDK test (Door 2: JS Snippet).
 * Run: node tests/sdk.test.js
 *
 * public/sdk.js is browser code, so this harness installs a minimal DOM /
 * fetch / Image stub before loading it. The stub is deliberately shallow —
 * it lets every placement renderer run without throwing so we can assert
 * the engine behaviour: placement registry, request shape (surface +
 * X-Lumi-Source + context), error codes, and context-joined feedback
 * beacons (impression / click / dismiss).
 */

const assert = require("assert");
const path   = require("path");

// ── Captured side effects ───────────────────────────────────────────────
let BEACONS = [];        // every tracking pixel URL fired
let LAST_REQUEST = null; // { url, headers, body }
let MOCK = { ok: true, payload: null };

// ── Minimal DOM stub ────────────────────────────────────────────────────
function makeEl(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    nodeType: 1,
    children: [],
    parentNode: null,
    dataset: {},
    _handlers: {},
    _q: {},
    _cls: new Set(),
    _className: "",
    _innerHTML: "",
    style: { setProperty() {}, },
    classList: {
      add() { for (const c of arguments) el._cls.add(c); },
      contains(c) { return el._cls.has(c); },
    },
    get className() { return el._className; },
    set className(v) { el._className = v; },
    get innerHTML() { return el._innerHTML; },
    set innerHTML(v) { el._innerHTML = v; },
    setAttribute(k, v) { el[k] = v; },
    getAttribute(k) { return el[k] === undefined ? null : el[k]; },
    appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
    removeChild(c) {
      const i = el.children.indexOf(c);
      if (i >= 0) el.children.splice(i, 1);
      c.parentNode = null; return c;
    },
    querySelector(sel) { if (!el._q[sel]) el._q[sel] = makeEl("div"); return el._q[sel]; },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { (el._handlers[ev] = el._handlers[ev] || []).push(fn); },
    _fire(ev) { (el._handlers[ev] || []).forEach((fn) => fn({ preventDefault() {} })); },
    focus() {}, load() {}, pause() {}, removeAttribute() {},
    play() { return Promise.resolve(); },
  };
  return el;
}

function installGlobals() {
  const byId = {};
  const doc = {
    _byId: byId,
    head: makeEl("head"),
    body: makeEl("body"),
    createElement: (t) => makeEl(t),
    getElementById(id) { if (!byId[id]) byId[id] = makeEl("div"); return byId[id]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  global.window = {};
  global.document = doc;
  global.navigator = { language: "en-US" };
  global.Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "UTC" }) }) };
  global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
  global.Image = function () {
    const self = this;
    Object.defineProperty(self, "src", { set(v) { BEACONS.push(v); } });
  };
  global.fetch = function (url, opts) {
    LAST_REQUEST = { url: url, headers: (opts && opts.headers) || {}, body: (opts && opts.body) || null };
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

const SDK_PATH = path.resolve(__dirname, "../public/sdk.js");
function loadSDK() {
  delete require.cache[SDK_PATH];
  BEACONS = []; LAST_REQUEST = null;
  require(SDK_PATH);
  return global.window.BoostBoss;
}

// A well-formed sponsored payload, mirroring api/mcp.js output.
function adPayload() {
  return {
    sponsored: {
      campaign_id: "cmp_test", type: "native",
      headline: "Try Acme CRM", subtext: "Built for small sales teams.",
      media_url: null, cta_label: "Start free", cta_url: "https://acme.example/crm",
      tracking: {
        impression: "https://boostboss.ai/api/track?event=impression&ctx=ctx_abc",
        click:      "https://boostboss.ai/api/track?event=click&ctx=ctx_abc",
        close:      "https://boostboss.ai/api/track?event=close&ctx=ctx_abc",
        skip:       "https://boostboss.ai/api/track?event=skip&ctx=ctx_abc",
        dismiss:    "https://boostboss.ai/api/track?event=dismiss&ctx=ctx_abc",
      },
    },
  };
}

installGlobals();

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("Lumi Web SDK · placement-engine test\n");

  // ── Registry ───────────────────────────────────────────────────────
  await test("exposes the five Web placements", () => {
    const BB = loadSDK();
    assert.deepStrictEqual(
      BB.placements.sort(),
      ["card", "chip", "citation", "corner", "loading"]);
  });

  await test("init without an API key surfaces NO_API_KEY", () => {
    const BB = loadSDK();
    BB.init({});
    assert.strictEqual(BB.getLastError().code, "NO_API_KEY");
  });

  // ── Error handling ─────────────────────────────────────────────────
  await test("unknown placement → BAD_PLACEMENT", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    const r = await BB.requestAd({ placement: "banner", context: "x" });
    assert.strictEqual(r, null);
    assert.strictEqual(BB.getLastError().code, "BAD_PLACEMENT");
  });

  await test("DOM placement without a mount → NO_MOUNT", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    const r = await BB.requestAd({ placement: "card", context: "x" });
    assert.strictEqual(r, null);
    assert.strictEqual(BB.getLastError().code, "NO_MOUNT");
  });

  await test("no-fill response → NO_FILL", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: { sponsored: null, reason: "no_campaigns" } };
    const r = await BB.requestAd({ placement: "card", context: "x", mount: makeEl("div") });
    assert.strictEqual(r, null);
    assert.strictEqual(BB.getLastError().code, "NO_FILL");
  });

  await test("HTTP error → SERVER_ERROR", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: false };
    const r = await BB.requestAd({ placement: "card", context: "x", mount: makeEl("div") });
    assert.strictEqual(r, null);
    assert.strictEqual(BB.getLastError().code, "SERVER_ERROR");
  });

  // ── Request shape ──────────────────────────────────────────────────
  await test("request carries context, surface, and X-Lumi-Source", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "card", context: "comparing CRM tools", mount: mount });
    assert.strictEqual(LAST_REQUEST.headers["X-Lumi-Source"], "js-snippet");
    const args = JSON.parse(LAST_REQUEST.body).params.arguments;
    assert.strictEqual(args.context_summary, "comparing CRM tools");
    assert.strictEqual(args.surface, "web-card");
    assert.strictEqual(args.developer_api_key, "bb_dev_test");
  });

  // ── Rendering + context-joined feedback ────────────────────────────
  await test("card renders into the mount and fires a context-joined impression", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    const ad = await BB.requestAd({ placement: "card", context: "x", mount: mount });
    assert.ok(ad, "returns the ad");
    assert.strictEqual(mount.children.length, 1, "card appended to mount");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u) && /ctx=ctx_abc/.test(u)),
      "impression beacon fired with context fingerprint");
  });

  await test("card click fires a context-joined click beacon", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "card", context: "x", mount: mount });
    const card = mount.children[0];
    card._q[".bb-card-ct"]._fire("click");
    assert.ok(BEACONS.some((u) => /event=click/.test(u) && /ctx=ctx_abc/.test(u)),
      "click beacon fired with context fingerprint");
  });

  await test("card dismiss fires a dismiss beacon and removes the card", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "card", context: "x", mount: mount });
    mount.children[0]._q[".bb-x"]._fire("click");
    assert.ok(BEACONS.some((u) => /event=dismiss/.test(u)), "dismiss beacon fired");
    assert.strictEqual(mount.children.length, 0, "card removed from DOM");
  });

  await test("citation renders and clicks", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "citation", context: "x", mount: mount });
    assert.strictEqual(mount.children.length, 1);
    mount.children[0]._q["a"]._fire("click");
    assert.ok(BEACONS.some((u) => /event=click/.test(u)));
  });

  await test("chip renders and fires impression", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    const ad = await BB.requestAd({ placement: "chip", context: "x", mount: mount });
    assert.ok(ad);
    assert.strictEqual(mount.children.length, 1);
    assert.ok(BEACONS.some((u) => /event=impression/.test(u)));
  });

  await test("loading ad renders; clearLoading tears it down silently", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "loading", context: "x", mount: mount });
    assert.strictEqual(mount.children.length, 1);
    const before = BEACONS.length;
    BB.clearLoading();
    assert.strictEqual(mount.children.length, 0, "loading ad removed");
    assert.strictEqual(BEACONS.length, before, "teardown fires no feedback beacon");
  });

  await test("corner placement self-mounts without throwing", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test" });
    MOCK = { ok: true, payload: adPayload() };
    const ad = await BB.requestAd({ placement: "corner", context: "x" });
    assert.ok(ad, "corner returns an ad");
    assert.ok(BEACONS.some((u) => /event=impression/.test(u)));
  });

  await test("session cap blocks further ads", async () => {
    const BB = loadSDK();
    BB.init({ apiKey: "bb_dev_test", maxAdsPerSession: 2 });
    MOCK = { ok: true, payload: adPayload() };
    const mount = makeEl("div");
    await BB.requestAd({ placement: "card", context: "x", mount: mount });
    await BB.requestAd({ placement: "card", context: "x", mount: mount });
    const r = await BB.requestAd({ placement: "card", context: "x", mount: mount });
    assert.strictEqual(r, null);
    assert.strictEqual(BB.getLastError().code, "SESSION_CAP");
  });

  console.log("\n" + (failed === 0
    ? "\x1b[32mAll " + passed + " SDK tests passed.\x1b[0m"
    : "\x1b[31m" + failed + " failed, " + passed + " passed.\x1b[0m"));
  process.exit(failed === 0 ? 0 : 1);
})();
