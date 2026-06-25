/**
 * Internal HTTP client. Speaks the same JSON-RPC envelope to /api/mcp
 * that the JS snippet (public/lumi.js) and lumi-mcp use. Bid path never
 * throws — failures resolve to a typed result.
 */
import { ERROR_CODES, codeForStatus, type ErrorCode } from "./errors.js";
import type { AdPayload, RenderOptions } from "./types.js";

export interface ClientOk { ok: true; ad: AdPayload | null; reason?: string | null }
export interface ClientErr { ok: false; code: ErrorCode; message: string }
export type ClientResp = ClientOk | ClientErr;

export interface ClientOptions {
  publisherId: string;
  apiBase:     string;
  timeoutMs:   number;
  source:      string;
}

let _idCounter = 0;
function nextId(): number {
  _idCounter = (_idCounter + 1) & 0x7fffffff;
  return _idCounter;
}

// Placement → auction format_preference. `corner` is the one interruptive
// surface; the rest are content placements the auction treats as native.
const FORMAT_PREF: Record<string, string> = {
  corner: "corner", newtab: "native", citation: "native", toolrec: "native",
};

export class Client {
  private readonly opts: ClientOptions;
  constructor(opts: ClientOptions) { this.opts = opts; }

  async fetchAd(o: RenderOptions, sessionId: string): Promise<ClientResp> {
    const url = this.opts.apiBase.replace(/\/$/, "") + "/api/mcp";
    const fmt = o.format ?? "citation";
    const args: Record<string, unknown> = {
      context_summary:   (o.context || "").slice(0, 1000),
      format_preference: FORMAT_PREF[fmt] ?? "native",
      session_id:        o.sessionId ?? sessionId,
      developer_api_key: this.opts.publisherId,
      publisher_id:      this.opts.publisherId,
      surface:           o.surface ?? ("ext-" + fmt),
    };
    if (o.userRegion)   args.user_region   = o.userRegion;
    if (o.userLanguage) args.user_language = o.userLanguage;
    if (o.hostApp)      args.host_app      = o.hostApp;

    const body = {
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/call",
      params: { name: "get_sponsored_content", arguments: args },
    };

    let resp: Response;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "X-Lumi-Source": this.opts.source,
        },
        body:   JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      const code = err.name === "AbortError" ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK;
      return { ok: false, code, message: err.message || "network error" };
    }

    if (!resp.ok) {
      const code = codeForStatus(resp.status);
      const message = await resp.text().catch(() => "").then((t) => t.slice(0, 200) || `HTTP ${resp.status}`);
      return { ok: false, code, message };
    }

    let json: unknown;
    try { json = await resp.json(); } catch (_e) {
      return { ok: false, code: ERROR_CODES.BAD_RESPONSE, message: "invalid JSON" };
    }

    const env = json as { result?: { content?: Array<{ type?: string; text?: string }> }; error?: { message?: string } };
    if (env.error) {
      return { ok: false, code: ERROR_CODES.BAD_RESPONSE, message: env.error.message || "RPC error" };
    }
    const text = env.result?.content?.[0]?.text;
    if (!text) {
      return { ok: false, code: ERROR_CODES.BAD_RESPONSE, message: "empty result" };
    }
    let payload: { sponsored?: SponsoredWire | null; auction?: AuctionWire; reason?: string };
    try { payload = JSON.parse(text); } catch (_e) {
      return { ok: false, code: ERROR_CODES.BAD_RESPONSE, message: "result text not JSON" };
    }

    if (!payload.sponsored) {
      return { ok: true, ad: null, reason: payload.reason ?? null };
    }
    return { ok: true, ad: adFromWire(payload.sponsored, payload.auction) };
  }
}

interface BrandKitWire {
  name?:        string | null;
  logo_url?:    string | null;
  favicon_url?: string | null;
  color?:       string | null;
  domain?:      string | null;
}
interface VoucherWire {
  value_text?:     string | null;
  code?:           string | null;
  redemption_url?: string | null;
}
interface SponsoredWire {
  campaign_id: string;
  type?: string;
  headline: string;
  subtext?: string;
  media_url?: string | null;
  cta_label?: string;
  cta_url: string;
  disclosure_label?: string;
  tracking?: { impression?: string; click?: string; close?: string; dismiss?: string };
  /** @since backend 2026-06-25 — global Creatives library brand kit. */
  brand_kit?: BrandKitWire | null;
  /** @since backend 2026-06-25 — global Creatives library voucher endcard. */
  voucher?:   VoucherWire | null;
}
interface AuctionWire {
  auction_id?: string;
  sandbox?:    boolean;
}

function adFromWire(s: SponsoredWire, a?: AuctionWire): AdPayload {
  // Brand kit + voucher: hydrate only when the server included them AND
  // at least one field is non-null. Older backends omit these entirely;
  // older SDK consumers ignore the optional fields. Forward-compatible
  // both ways.
  const bk = s.brand_kit && (s.brand_kit.name || s.brand_kit.logo_url || s.brand_kit.domain)
    ? {
        name:       s.brand_kit.name       ?? null,
        logoUrl:    s.brand_kit.logo_url   ?? null,
        faviconUrl: s.brand_kit.favicon_url ?? null,
        color:      s.brand_kit.color      ?? null,
        domain:     s.brand_kit.domain     ?? null,
      }
    : null;
  const vc = s.voucher && s.voucher.value_text
    ? {
        valueText:     s.voucher.value_text     ?? null,
        code:          s.voucher.code           ?? null,
        redemptionUrl: s.voucher.redemption_url ?? null,
      }
    : null;
  return {
    adId:            s.campaign_id,
    auctionId:       a?.auction_id ?? null,
    type:            s.type ?? "native",
    headline:        s.headline ?? "",
    body:            s.subtext ?? "",
    mediaUrl:        s.media_url ?? null,
    ctaLabel:        s.cta_label ?? "Learn more",
    ctaUrl:          s.cta_url,
    impressionUrl:   s.tracking?.impression ?? null,
    tracking: {
      impression: s.tracking?.impression ?? null,
      click:      s.tracking?.click ?? null,
      close:      s.tracking?.close ?? null,
      dismiss:    s.tracking?.dismiss ?? null,
    },
    disclosureLabel: s.disclosure_label ?? "Sponsored",
    isSandbox:       a?.sandbox === true,
    brandKit:        bk,
    voucher:         vc,
  };
}
