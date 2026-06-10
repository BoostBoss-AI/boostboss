# Auth Branding — Custom Domain + Branded Google OAuth

**Goal:** Replace the raw `glogijhwbrdkkjdsjujc.supabase.co` URL and the generic Supabase-branded Google consent screen with a fully boostboss.ai-branded sign-in experience.

**End state:**
- Google consent screen reads: *"Choose an account to continue to **Boost Boss***" with the boost-boss logo
- URL bar during OAuth redirect shows: `auth.boostboss.ai/auth/v1/...`
- No "unverified app" warning (after Google approves the consent screen)

**Status:** Andy is on Supabase Pro, both fixes available.

**Wall-clock time:** ~2 hours active work + 1-3 days passive (Google verification queue).

---

## Step 1 — Supabase Custom Domain (do first)

Reason for ordering: the OAuth callback URI Google needs to know depends on this. If you set up Google's OAuth client first, you'd have to come back and update its redirect URI after the custom domain goes live.

1.1. Supabase Dashboard → your project → **Project Settings** → **Custom Domains** → **Add custom domain**

1.2. Enter `auth.boostboss.ai` (standard subdomain convention; `auth.` is conventional and lets you keep `api.` etc. free for later)

1.3. Supabase will display a **CNAME record** to add at your DNS provider. The target will look something like `<project-id>.supabase.co` or a custom Supabase CDN endpoint.

1.4. Go to **Vercel DNS** (the boostboss.ai domain registrar/DNS, currently Vercel) → boostboss.ai → DNS → Add Record:
   - Type: `CNAME`
   - Name: `auth`
   - Value: [paste the target Supabase gave you]
   - TTL: 60 (low for fast iteration; bump up later)

1.5. Back in Supabase → click **Verify**. May take 5-30 minutes for DNS propagation.

1.6. Once verified, click **Activate**. Supabase will provision an SSL cert for `auth.boostboss.ai` and route all auth traffic through it.

1.7. **Confirm the new auth URL works.** Open `https://auth.boostboss.ai/auth/v1/health` in a browser. Should return `{"status":"ok"}` or similar. If not, wait another 10 min and retry.

**Output of Step 1:** Custom domain live. New OAuth callback URL is `https://auth.boostboss.ai/auth/v1/callback`.

---

## Step 2 — Google Cloud Console: OAuth Consent Screen

This step submits your app for Google's verification queue, which runs in parallel with Step 3-4. Start it as early as possible so the 1-3 day clock starts ticking.

2.1. Go to **Google Cloud Console** → your boostboss.ai project (created in task #13)

2.2. **APIs & Services** → **OAuth consent screen**

2.3. **User Type:** External (you want anyone with a Google account to sign in)

2.4. **App Information:**
   - **App name:** `Boost Boss`
   - **User support email:** `support@boostboss.ai`
   - **App logo:** Upload a 120x120 PNG of the boost-boss rocket b-mark. (If you don't have one ready, the favicon at `boostboss.ai/favicon.png` can work — Google accepts up to 1MB.)

2.5. **App Domain:**
   - **Application home page:** `https://boostboss.ai`
   - **Application privacy policy:** `https://boostboss.ai/privacy`
   - **Application terms of service:** `https://boostboss.ai/terms`

2.6. **Authorized domains:** Add `boostboss.ai`

2.7. **Developer contact:** `support@boostboss.ai` (or `admin@boostboss.ai` if you prefer)

2.8. Click **Save and Continue**.

2.9. **Scopes:** Click **Add or Remove Scopes**. Select only:
   - `.../auth/userinfo.email` (email)
   - `.../auth/userinfo.profile` (profile)
   - `openid`

   **Do NOT add any sensitive or restricted scopes** — these would trigger a much slower verification (potentially weeks). The three above are "non-sensitive" and verify within 1-3 days.

2.10. Click **Save and Continue** → **Save and Continue** through Test Users (skip, since you're going straight to Production) → **Back to Dashboard**

2.11. **Publish App** → confirm. Status changes from "Testing" to "In Production" with verification pending.

2.12. **Submit for Verification** if Google prompts — for non-sensitive scopes this is usually auto-approved within 1-3 business days.

**Output of Step 2:** OAuth consent screen submitted. Verification clock running.

---

## Step 3 — Google Cloud Console: OAuth 2.0 Client ID

3.1. Same Google Cloud project → **Credentials** → **Create Credentials** → **OAuth client ID**

3.2. **Application type:** Web application

3.3. **Name:** `Boost Boss Auth (Production)` — internal label, not user-facing

3.4. **Authorized JavaScript origins:** Add both:
   - `https://boostboss.ai`
   - `https://www.boostboss.ai`

3.5. **Authorized redirect URIs:** Add:
   - `https://auth.boostboss.ai/auth/v1/callback`  ← the custom domain from Step 1

   Optional fallback during transition (delete after a week):
   - `https://glogijhwbrdkkjdsjujc.supabase.co/auth/v1/callback`

3.6. Click **Create**. Google will display:
   - **Client ID:** `XXX.apps.googleusercontent.com`
   - **Client Secret:** `GOCSPX-XXX`

   Copy both immediately. Store in your password manager.

**Output of Step 3:** Branded OAuth client ID/secret ready to wire into Supabase.

---

## Step 4 — Supabase: Swap In the New Credentials

4.1. Supabase Dashboard → **Authentication** → **Providers** → **Google**

4.2. **Client ID (for OAuth):** Paste the new `XXX.apps.googleusercontent.com`

4.3. **Client Secret (for OAuth):** Paste the new `GOCSPX-XXX`

4.4. If there's a toggle for "Use Supabase's shared OAuth credentials" — turn it **OFF**.

4.5. **Save**.

**Output of Step 4:** Supabase now uses your branded Google OAuth client.

---

## Step 5 — Smoke Test

5.1. Open a **fresh incognito window** (no Google session cached).

5.2. Navigate to `https://boostboss.ai/ads/signup`

5.3. Click **Sign in with Google**.

5.4. **What you should see:**
   - URL bar during the Google consent screen: `accounts.google.com/o/oauth2/...`
   - Consent screen header: **"Choose an account to continue to Boost Boss"**
   - Your boost-boss logo displayed above the heading
   - "This app isn't verified" interstitial — **this is expected until Google approves Step 2**, click "Advanced" → "Go to Boost Boss (unsafe)" to continue testing
   - After consent, URL bar redirects through `auth.boostboss.ai/auth/v1/callback?...` and then back to `boostboss.ai/ads/dashboard`

5.5. **If "Choose an account to continue to glogijhwbrdkkjdsjujc.supabase.co" still appears** → Step 4 didn't take. Recheck Supabase provider config, make sure shared credentials toggle is OFF.

5.6. **If the redirect 404s or shows a Supabase error page** → Step 3 redirect URI doesn't match what Supabase is sending. Check Supabase logs (Authentication → Logs) for the exact callback URL it tried.

---

## Step 6 — Wait for Google Verification

6.1. Check **Google Cloud Console → OAuth consent screen → Verification status** daily.

6.2. When status changes to **"Verified"** (typically 1-3 business days for non-sensitive scopes), the "unverified app" warning disappears for all users.

6.3. Test signup again in incognito to confirm the warning is gone.

---

## Step 7 — Cleanup (optional, after verification is confirmed)

7.1. In Google Cloud Console → Credentials → your new OAuth Client → remove the old fallback redirect URI (`glogijhwbrdkkjdsjujc.supabase.co/auth/v1/callback`) if you added it as fallback in Step 3.5.

7.2. Document the new credentials location for future ops: store Client ID + Secret in 1Password or whichever password manager, labeled "Boost Boss Production Google OAuth."

7.3. Optionally update internal docs / runbooks if any reference the raw Supabase URL.

---

## Gotchas to watch for

- **DNS propagation can be slow.** If Step 1.5 verify fails repeatedly, wait 30+ min and retry. Don't keep clicking — that doesn't help.
- **Logo upload is strict.** Google rejects logos with text-only designs, lossy artifacts, or transparency issues. PNG with solid background, 120-1200px square, under 1MB.
- **Privacy policy page must be reachable WITHOUT auth.** Google's verifier crawls `boostboss.ai/privacy` from a bot UA — make sure no signin wall.
- **Don't add sensitive scopes "just in case."** Adding gmail.readonly or drive.* would push verification from 1-3 days to weeks-months with mandatory app review.
- **The "unverified app" warning is per-user-trust.** Until verification completes, every new user sees the warning. You can technically still complete signup by clicking through, but conversion will drop. Verification is the unlock.

---

**Last updated:** 2026-06-10
**Owner:** Andy Dasouth
**Related:**
- Supabase project: glogijhwbrdkkjdsjujc.supabase.co (production)
- Google Cloud project: boostboss.ai workspace (task #13)
- Legal pages: `/privacy`, `/terms` (task #19)
- Vercel DNS: boostboss.ai zone
