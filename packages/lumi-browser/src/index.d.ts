// Type definitions for @boostbossai/lumi-browser

export interface LumiInitOptions {
  /** Your publisher ID from the Boost Boss dashboard (pub_xxx). */
  publisherId: string;
  /** Override the API base. Default: 'https://boostboss.ai'. Use for
   *  sandbox / staging / self-hosted environments. */
  apiBase?: string;
  /** Enable verbose console logging. Default: false. */
  debug?: boolean;
}

export interface LumiRenderOptions {
  /** Placement format. One of the 8 Browser App door placements.
   *  Defaults inferred from the element's data-lumi-format attribute,
   *  or 'card' if not specified. */
  format?: 'corner' | 'card' | 'citation' | 'chip' | 'hero' | 'loading' | 'settings' | 'interstitial';
  /** Free-form context string used for intent matching by Benna. */
  context?: string;
  /** Stable per-session identifier for frequency capping. */
  sessionId?: string;
}

export interface LumiConversionPayload {
  /** Conversion type — 'signup' | 'purchase' | 'trial' | etc. */
  type: string;
  /** Optional value of the conversion (e.g. purchase amount). */
  value?: number;
  /** ISO currency code, e.g. 'USD'. Defaults to 'USD'. */
  currency?: string;
  /** Optional metadata payload. */
  [key: string]: unknown;
}

export interface LumiError {
  code: string;
  message: string;
  detail?: unknown;
  ts: number;
}

/** The Lumi global object exposed by the underlying lumi.js script. */
export interface LumiInstance {
  version: string;
  __loaded: boolean;
  render(el: Element, opts?: LumiRenderOptions): unknown;
  refresh(selector?: string): unknown;
  destroy(): unknown;
  trackConversion(payload: LumiConversionPayload): unknown;
  getLastError(): LumiError | null;
  setDebug(on: boolean): void;
}

/** Boot the Lumi runtime. First call kicks off the script load;
 *  subsequent calls return the cached promise. Resolves to the
 *  window.Lumi global. */
export function init(options: LumiInitOptions): Promise<LumiInstance>;

/** Manually mount an ad in the given slot element. */
export function render(el: Element, opts?: LumiRenderOptions): Promise<unknown>;

/** Re-fetch + re-render. Pass a CSS selector to scope to specific slots. */
export function refresh(selector?: string): Promise<unknown>;

/** Tear down all rendered ads and disconnect observers. */
export function destroy(): Promise<unknown>;

/** Fire a publisher-side conversion event. */
export function trackConversion(payload: LumiConversionPayload): Promise<unknown>;

/** Latest error object, or null. */
export function getLastError(): Promise<LumiError | null>;

/** Toggle debug logging at runtime. */
export function setDebug(on: boolean): Promise<unknown>;

/** Subscribe to a Lumi event. Returns an unsubscribe function. */
export function on(
  eventName: 'ready' | 'no_fill' | 'error' | 'impression' | 'click' | 'close',
  handler: (detail: unknown) => void
): () => void;

/** SDK semver. */
export const version: string;
