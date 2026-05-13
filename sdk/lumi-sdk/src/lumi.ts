/**
 * Lumi — programmatic ad rendering for environments where a <script>
 * tag isn't an option (browser extensions in Manifest v3, Electron /
 * Tauri renderers, frameworks that build their bundle).
 *
 * Same backend as the JS snippet (public/lumi.js); same wire shape.
 * Different surface: this is a class you instantiate and call methods
 * on, instead of a script tag that auto-discovers slots.
 */
import { Client } from "./client.js";
import { TypedEmitter } from "./emitter.js";
import { ERROR_CODES } from "./errors.js";
import {
  injectStyles, renderAd, fireImpressionBeacon, unmountSlot, resetStyles,
} from "./renderer.js";
import type {
  LumiOptions, RenderOptions, AdPayload,
  LumiEventName, LumiHandler,
} from "./types.js";

const VERSION = "0.1.0";
const DEFAULT_API_BASE = "https://boostboss.ai";
const DEFAULT_TIMEOUT_MS = 4000;

interface SlotState {
  el:        HTMLElement;
  format:    string;
  ad:        AdPayload | null;
  backdrop:  HTMLElement | null;
}

export class Lumi {
  static readonly version = VERSION;

  private readonly publisherId: string;
  private readonly apiBase:     string;
  private readonly client:      Client;
  private readonly emitter      = new TypedEmitter();
  private readonly slots        = new Map<HTMLElement, SlotState>();
  private readonly sessionId:   string;
  private readonly debugEnabled: boolean;
  private destroyed             = false;

  constructor(options: LumiOptions) {
    if (!options || typeof options !== "object") {
      throw new TypeError("Lumi: options object required");
    }
    if (!options.publisherId || typeof options.publisherId !== "string") {
      throw new TypeError("Lumi: 'publisherId' is required (e.g. 'pub_xxx')");
    }
    this.publisherId  = options.publisherId;
    this.apiBase      = options.apiBase ?? DEFAULT_API_BASE;
    this.debugEnabled = Boolean(options.debug);
    this.sessionId    = "lumi_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now();

    this.client = new Client({
      publisherId: options.publisherId,
      apiBase:     this.apiBase,
      timeoutMs:   options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      source:      "npm-sdk",
    });

    this.emitter.emit("ready", { version: VERSION, sessionId: this.sessionId });
  }

  /**
   * Render an ad into a slot element. Returns the rendered Ad payload
   * (or null on no-fill / error). Never throws.
   */
  async render(target: string | HTMLElement, opts: RenderOptions = {}): Promise<AdPayload | null> {
    if (this.destroyed) return null;
    if (typeof document === "undefined") {
      this.emitter.emit("error", {
        code: ERROR_CODES.NO_DOM,
        message: "Lumi.render() requires a DOM (document is undefined). Use this in a content script or renderer process, not a service worker.",
      });
      return null;
    }

    const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
    if (!el) {
      this.emitter.emit("error", {
        code: ERROR_CODES.BAD_REQUEST,
        message: "Lumi.render() target not found: " + String(target),
      });
      return null;
    }
    const format  = opts.format ?? "banner";
    const context = opts.context ?? "";

    // Already mounted? Tear down first so we re-fetch + re-render fresh.
    const existing = this.slots.get(el);
    if (existing) unmountSlot(existing.el, existing.backdrop);

    const resp = await this.client.fetchAd(opts, this.sessionId);
    if (!resp.ok) {
      this.emitter.emit("error", { code: resp.code, message: resp.message });
      return null;
    }
    if (!resp.ad) {
      this.emitter.emit("no_fill", { context, reason: resp.reason ?? null });
      this.slots.set(el, { el, format, ad: null, backdrop: null });
      return null;
    }

    const ad = resp.ad;
    const onClick = () => {
      this.emitter.emit("click", {
        adId: ad.adId, auctionId: ad.auctionId, slot: el,
      });
    };
    const { backdrop } = renderAd(el, ad, format, onClick);
    this.slots.set(el, { el, format, ad, backdrop });

    if (ad.impressionUrl) fireImpressionBeacon(ad.impressionUrl);
    this.emitter.emit("impression", {
      adId:      ad.adId,
      auctionId: ad.auctionId,
      format,
      slot:      el,
      sandbox:   ad.isSandbox,
    });

    if (this.debugEnabled) {
      // eslint-disable-next-line no-console
      console.error("[lumi-sdk] rendered " + format + ":", ad.headline);
    }
    return ad;
  }

  /**
   * Re-fetch and re-render every mounted slot, OR a single slot when a
   * selector / element is passed.
   */
  async refresh(target?: string | HTMLElement): Promise<void> {
    if (this.destroyed) return;
    if (target !== undefined) {
      const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
      if (!el) return;
      const existing = this.slots.get(el);
      if (!existing) return;
      await this.render(el, { format: existing.format as RenderOptions["format"] });
      return;
    }
    const entries = [...this.slots.entries()];
    for (const [el, state] of entries) {
      await this.render(el, { format: state.format as RenderOptions["format"] });
    }
  }

  /**
   * Fire a conversion event tied to an ad served in this session.
   *
   * Phase B (2026-05-11) — adds publisher-side conversion firing for
   * in-app conversions where the conversion happens in the same surface
   * that hosted the ad (browser extension popup, Electron, embedded web).
   * For conventional advertiser-side conversions on a separate landing
   * page, advertisers should use the public/pixel.js script instead.
   *
   * Resolution order for adId/auctionId:
   *   1. Explicit `opts.adId` / `opts.auctionId`
   *   2. The `opts.slot` reference (must be a slot we previously rendered)
   *   3. Any one of our currently-mounted slots (best-effort)
   */
  async trackConversion(opts: {
    type:        string;
    adId?:       string;
    auctionId?:  string;
    slot?:       string | HTMLElement;
    value?:      number;
    currency?:   string;
    externalId?: string;
  }): Promise<void> {
    if (this.destroyed) return;
    if (!opts || !opts.type) {
      this.emitter.emit("error", {
        code: ERROR_CODES.BAD_REQUEST,
        message: "trackConversion: 'type' is required (e.g. 'signup', 'purchase')",
      });
      return;
    }

    let adId      = opts.adId      ?? null;
    let auctionId = opts.auctionId ?? null;

    if (!adId || !auctionId) {
      let slotEl: HTMLElement | null = null;
      if (opts.slot) {
        slotEl = typeof opts.slot === "string"
          ? (typeof document !== "undefined" ? document.querySelector<HTMLElement>(opts.slot) : null)
          : opts.slot;
      }
      const state = slotEl ? this.slots.get(slotEl) : null;
      if (state?.ad) {
        adId      = adId      ?? state.ad.adId;
        auctionId = auctionId ?? state.ad.auctionId;
      } else {
        for (const s of this.slots.values()) {
          if (!s.ad) continue;
          adId      = adId      ?? s.ad.adId;
          auctionId = auctionId ?? s.ad.auctionId;
          if (adId && auctionId) break;
        }
      }
    }

    if (!adId) {
      this.emitter.emit("error", {
        code: ERROR_CODES.BAD_REQUEST,
        message: "trackConversion: cannot determine adId — pass opts.adId, opts.slot, or call after an ad has rendered",
      });
      return;
    }

    const body: Record<string, unknown> = {
      event:           "conversion",
      campaign_id:     adId,
      auction_id:      auctionId,
      conversion_type: opts.type,
      value:           opts.value ?? null,
      currency:        opts.currency ?? "USD",
      external_id:     opts.externalId ?? null,
      session_id:      this.sessionId,
    };

    try {
      const url = this.apiBase.replace(/\/$/, "") + "/api/track";
      const resp = await fetch(url, {
        method:    "POST",
        keepalive: true,
        headers: {
          "Content-Type":  "application/json",
          "X-Lumi-Source": "npm-sdk",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        this.emitter.emit("error", {
          code:    ERROR_CODES.BAD_RESPONSE,
          message: `conversion beacon rejected: HTTP ${resp.status}`,
        });
      }
    } catch (e) {
      const err = e as { message?: string };
      this.emitter.emit("error", {
        code:    ERROR_CODES.NETWORK,
        message: `conversion beacon failed: ${err.message || "network error"}`,
      });
    }
  }

  /** Tear down all rendered ads and remove the injected stylesheet. */
  destroy(): void {
    if (this.destroyed) return;
    for (const state of this.slots.values()) {
      unmountSlot(state.el, state.backdrop);
    }
    this.slots.clear();
    if (typeof document !== "undefined") {
      const sty = document.getElementById("lumi-styles");
      if (sty) sty.remove();
    }
    resetStyles();
    this.destroyed = true;
  }

  /** Subscribe to SDK events. */
  on<E extends LumiEventName>(event: E, handler: LumiHandler<E>): void {
    this.emitter.on(event, handler);
  }

  /** Unsubscribe a previously-registered handler. */
  off<E extends LumiEventName>(event: E, handler: LumiHandler<E>): void {
    this.emitter.off(event, handler);
  }

  /** Expose the publisher's session ID for debugging / cross-call correlation. */
  getSessionId(): string { return this.sessionId; }

  /**
   * Pre-warm the SDK's stylesheet without rendering an ad. Useful when
   * you know slots will mount later and want to avoid a layout shift
   * the first time render() runs.
   */
  primeStyles(): void { injectStyles(); }
}
