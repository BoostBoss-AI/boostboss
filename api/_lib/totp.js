// ============================================================================
// totp.js — RFC 6238 TOTP implementation in pure Node.
//
// Used by the /api/auth MFA actions for enroll, verify, and step-up auth.
// No external dependencies — only the Node `crypto` module. Safer than
// pulling a 3rd-party TOTP package since this is in the auth hot path.
//
// Defaults: SHA-1, 30-second step, 6-digit code — exactly what Google
// Authenticator / Authy / 1Password expect. Don't change these unless you
// also coordinate the otpauth:// URI on enroll.
//
// Drift tolerance: ±1 step (±30s) accepted. Matches RFC guidance and
// covers ordinary clock skew without making brute force significantly easier.
// ============================================================================

"use strict";

const crypto = require("crypto");

// RFC 4648 §6 base32 alphabet (no padding for QR-readable shorter URIs).
const B32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateBase32Secret(byteLength = 20) {
  // 20 bytes = 160 bits of entropy, matches the RFC 6238 recommendation
  // for SHA-1-based TOTP. Encoded as base32 it's 32 characters with no
  // padding, which fits comfortably in QR codes and manual entry.
  const buf = crypto.randomBytes(byteLength);
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_ALPHA[(value >>> bits) & 31];
    }
  }
  if (bits > 0) {
    out += B32_ALPHA[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(b32) {
  // Strip spaces and pad chars; uppercase. Authenticator apps display
  // secrets in space-grouped form; users may copy with spaces.
  const clean = String(b32).toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHA.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function generateCode(base32Secret, timestepSeconds = 30, digits = 6, nowMs = Date.now()) {
  const counter = Math.floor(nowMs / 1000 / timestepSeconds);
  const counterBuf = Buffer.alloc(8);
  // Big-endian 64-bit counter. JavaScript bitwise ops are 32-bit so we
  // split it: upper 32 bits get the high 4 bytes, lower 32 the low 4.
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const key = base32Decode(base32Secret);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binCode % Math.pow(10, digits);
  return String(otp).padStart(digits, "0");
}

function verifyCode(base32Secret, userCode, window = 1, nowMs = Date.now()) {
  // Strip whitespace; Google Authenticator displays "123 456".
  const code = String(userCode || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  // Check the current step and ±window neighboring steps to tolerate
  // ordinary clock drift between server and authenticator app.
  for (let drift = -window; drift <= window; drift++) {
    const candidate = generateCode(
      base32Secret,
      30,
      6,
      nowMs + drift * 30 * 1000,
    );
    if (constantTimeEquals(candidate, code)) return true;
  }
  return false;
}

function constantTimeEquals(a, b) {
  // Use Node's timingSafeEqual after equal-length normalization. Strings
  // of different lengths are immediately unequal — that's not a timing
  // leak because the length isn't the secret.
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildOtpauthURI({ secret, accountName, issuer = "Boost Boss" }) {
  // otpauth://totp/{issuer}:{account}?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30
  const labelIssuer = encodeURIComponent(issuer);
  const labelAccount = encodeURIComponent(accountName);
  const params = [
    "secret=" + encodeURIComponent(secret),
    "issuer=" + encodeURIComponent(issuer),
    "algorithm=SHA1",
    "digits=6",
    "period=30",
  ].join("&");
  return `otpauth://totp/${labelIssuer}:${labelAccount}?${params}`;
}

module.exports = {
  generateBase32Secret,
  generateCode,
  verifyCode,
  buildOtpauthURI,
};
