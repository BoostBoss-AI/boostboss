# Playbook — Sending-Domain Warm-up (cold outreach)

Goal: land in inboxes, not spam — and protect boostboss.ai's main reputation. Until this is done,
**no cold outreach goes out** (the gate already holds it). Timeline: ~3–4 weeks before first real sends.

## 1. Don't send cold mail from the wrong place
- **Not Google Workspace** (admin@/promo@ via Gmail) — Gmail isn't built for cold outreach; you risk the account.
- **Not a transactional ESP** (Resend/SendGrid) — their terms usually **forbid cold/unsolicited email**; the
  account gets banned. Keep Resend for receipts/welcome only.
- **Use a dedicated cold-email tool** with built-in inbox warm-up (e.g. Instantly, Smartlead). They ramp
  reputation automatically and manage send caps.

## 2. Use a separate sending domain (protect the brand)
- Register a secondary domain just for outreach (e.g. `try-boostboss.com` / `getboostboss.com`) — or a
  subdomain like `outreach.boostboss.ai`. If outreach reputation ever dips, your main domain + customer
  mail are untouched.
- Point that domain's sending at the cold-email tool.

## 3. Authenticate (non-negotiable)
- Set **SPF, DKIM, DMARC** DNS records on the sending domain (the tool gives you the exact records;
  you add them at your registrar/DNS host). Without these you go straight to spam.

## 4. Warm up (2–4 weeks, automated)
- Turn on the tool's warm-up: it sends/receives among a pool and ramps volume to build reputation.
- Don't send real outreach during early warm-up.

## 5. Ramp + hygiene (after warm-up)
- Start ~10–20 real sends/day per inbox; increase ~20–30%/week.
- Verify addresses before sending (cut bounces); keep bounce + spam-complaint rates low (<2–3%).
- Personalize every email (the Benna-Reach drafts already do); honor opt-out instantly.

## 6. Gate stays on
- Even warmed, real sends route through **#approvals** and you fire them from your Mac (sandbox can't send).
- Meanwhile the daily run keeps filling the prospect pipeline — gated — so you have volume ready when warm.

## First step for Andy
Decide: (1) the cold-email tool, (2) the sending domain/subdomain. Then add the SPF/DKIM/DMARC records
the tool provides and start its warm-up. That clock runs in the background while the pipeline fills.
