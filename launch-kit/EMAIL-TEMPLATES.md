# Boost Boss — Supabase Email Templates

Branded HTML email templates for the 4 auth emails Supabase actually sends from boostboss.ai. Paste each into **Supabase Dashboard → Authentication → Emails → Templates**.

**Last updated:** 2026-06-11 (rocket logo added; all 4 active templates included)

---

## Prerequisites

1. **Logo file deployed**: `public/email-logo.png` exists in the boostboss repo (the 480×480 rocket b-mark). It's reachable at `https://boostboss.ai/email-logo.png` once pushed to main + Vercel deploys. The `<img>` tags in the templates below point to that URL.

2. **Custom SMTP active**: Resend SMTP configured in Supabase (see SMTP section at bottom).

3. **Custom domain active**: `auth.boostboss.ai` is the verified custom domain so the action URLs (`{{ .ConfirmationURL }}`) come pre-branded.

---

## How to apply each template

For each of the 4 templates below:

1. Open **Supabase Dashboard → Authentication → Emails → Templates** tab
2. Click the matching template name (e.g. "Confirm sign up")
3. **Subject line**: replace with the one specified above each template
4. **Body** (HTML editor): clear it, paste the full HTML
5. **Critical**: keep `{{ .ConfirmationURL }}` exactly as written wherever it appears. Supabase substitutes the real verification link at send-time. If you delete it, the action button breaks.
6. Click **Save**
7. Test by triggering the flow (signup, password reset, etc.)

---

## 1. Confirm sign up

**Subject:** `Confirm your Boost Boss account 🚀`

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirm your Boost Boss account</title>
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 560px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 44px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo-img { width: 56px; height: 56px; display: block; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #1A1A2E; line-height: 1; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; letter-spacing: -0.3px; }
  p { font-size: 15.5px; line-height: 1.65; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 30px 0 22px; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 10px; text-decoration: none; }
  .btn:hover { background: #E01E65; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; margin-top: 18px; }
  .fallback a { color: #FF2D78; text-decoration: underline; }
  .what-next { background: #FFF5F8; border: 1px solid #FFD0E0; border-radius: 10px; padding: 16px 18px; margin: 24px 0 0; font-size: 14px; color: #4B4B5E; line-height: 1.55; }
  .what-next strong { color: #1A1A2E; display: block; margin-bottom: 6px; font-size: 14.5px; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0 22px; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; line-height: 1.6; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo-row">
        <img class="logo-img" src="https://boostboss.ai/email-logo.png" alt="Boost Boss" width="56" height="56">
        <div class="brand">Boost Boss</div>
      </div>

      <h1>Confirm your email</h1>
      <p>Welcome to Boost Boss — the AI-native ad network. Click the button below to activate your account and start launching campaigns.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm email</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>

      <div class="what-next">
        <strong>What's next?</strong>
        Once confirmed, you'll land on your dashboard where you can fund your account, launch your first campaign, and reach AI-native users via SuperBoost Ads. Need help? Reply to this email anytime.
      </div>

      <hr class="divider">

      <p class="foot">
        If you didn't sign up for Boost Boss, you can safely ignore this email.<br><br>
        Questions? <a href="mailto:support@boostboss.ai">support@boostboss.ai</a><br>
        Boost Boss · <a href="https://boostboss.ai/privacy">Privacy</a> · <a href="https://boostboss.ai/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Reset password

**Subject:** `Reset your Boost Boss password`

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your Boost Boss password</title>
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 560px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 44px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo-img { width: 56px; height: 56px; display: block; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #1A1A2E; line-height: 1; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; letter-spacing: -0.3px; }
  p { font-size: 15.5px; line-height: 1.65; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 30px 0 22px; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 10px; text-decoration: none; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; margin-top: 18px; }
  .fallback a { color: #FF2D78; text-decoration: underline; }
  .warn { background: #FFF7E6; border: 1px solid #FCD34D; border-radius: 10px; padding: 14px 18px; font-size: 13.5px; color: #B97309; margin: 22px 0 0; line-height: 1.55; }
  .warn strong { color: #92400E; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0 22px; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; line-height: 1.6; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo-row">
        <img class="logo-img" src="https://boostboss.ai/email-logo.png" alt="Boost Boss" width="56" height="56">
        <div class="brand">Boost Boss</div>
      </div>

      <h1>Reset your password</h1>
      <p>We received a request to reset the password on your Boost Boss account. Click the button below to choose a new one.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Reset password</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>

      <div class="warn">
        <strong>⏱ This link expires in 1 hour.</strong> If you need a new one, request another reset from the sign-in page.
      </div>

      <hr class="divider">

      <p class="foot">
        <strong>Didn't request this?</strong> You can safely ignore this email — your password won't change unless you click the link.<br>
        If you think someone else is trying to access your account, reply to this email or contact <a href="mailto:support@boostboss.ai">support@boostboss.ai</a> immediately.<br><br>
        Boost Boss · <a href="https://boostboss.ai/privacy">Privacy</a> · <a href="https://boostboss.ai/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Change email address

**Subject:** `Confirm your new Boost Boss email`

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirm your new Boost Boss email</title>
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 560px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 44px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo-img { width: 56px; height: 56px; display: block; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #1A1A2E; line-height: 1; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; letter-spacing: -0.3px; }
  p { font-size: 15.5px; line-height: 1.65; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 30px 0 22px; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 10px; text-decoration: none; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; margin-top: 18px; }
  .fallback a { color: #FF2D78; text-decoration: underline; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0 22px; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; line-height: 1.6; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo-row">
        <img class="logo-img" src="https://boostboss.ai/email-logo.png" alt="Boost Boss" width="56" height="56">
        <div class="brand">Boost Boss</div>
      </div>

      <h1>Confirm your new email</h1>
      <p>You requested to change your account email from <strong style="color:#1A1A2E;">{{ .Email }}</strong> to <strong style="color:#1A1A2E;">{{ .NewEmail }}</strong>. Click the button below to confirm the new address.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm new email</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>

      <hr class="divider">

      <p class="foot">
        <strong>Didn't request this change?</strong> Contact <a href="mailto:support@boostboss.ai">support@boostboss.ai</a> immediately — someone may have access to your account.<br><br>
        Boost Boss · <a href="https://boostboss.ai/privacy">Privacy</a> · <a href="https://boostboss.ai/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Password changed (security notification)

**Subject:** `Your Boost Boss password was changed`

**Note:** This template fires automatically after a successful password reset. It's a "we noticed your password changed, was that you?" security notification — no action button needed.

**Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Boost Boss password was changed</title>
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 560px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 44px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo-img { width: 56px; height: 56px; display: block; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #1A1A2E; line-height: 1; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; letter-spacing: -0.3px; }
  p { font-size: 15.5px; line-height: 1.65; color: #4B4B5E; margin: 0 0 16px; }
  .alert { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #065F46; margin: 22px 0; line-height: 1.55; }
  .alert strong { color: #064E3B; }
  .danger { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 14px 18px; font-size: 13.5px; color: #991B1B; margin: 18px 0 0; line-height: 1.55; }
  .danger strong { color: #7F1D1D; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0 22px; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; line-height: 1.6; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo-row">
        <img class="logo-img" src="https://boostboss.ai/email-logo.png" alt="Boost Boss" width="56" height="56">
        <div class="brand">Boost Boss</div>
      </div>

      <h1>Your password was changed</h1>
      <p>This is a confirmation that the password on your Boost Boss account was just changed.</p>

      <div class="alert">
        <strong>✓ If this was you</strong> — you don't need to do anything. You can sign in with your new password at <a href="https://boostboss.ai/ads/signin" style="color:#065F46; text-decoration:underline;">boostboss.ai</a>.
      </div>

      <div class="danger">
        <strong>⚠ If this wasn't you</strong> — someone may have accessed your account. Contact <a href="mailto:support@boostboss.ai" style="color:#7F1D1D; text-decoration:underline;">support@boostboss.ai</a> immediately and reset your password from the sign-in page.
      </div>

      <hr class="divider">

      <p class="foot">
        Boost Boss · <a href="https://boostboss.ai/privacy">Privacy</a> · <a href="https://boostboss.ai/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Required Supabase setting toggles

Before any of this works, these need to be ON in **Supabase Dashboard → Authentication → Sign In / Providers → Email**:

1. **Confirm email** → ON (so signup triggers Confirm signup template)
2. **Secure email change** → ON (requires double confirmation when changing email — sends to both old and new address)

And in **Authentication → URL Configuration**:

3. **Site URL** = `https://boostboss.ai`
4. **Redirect URLs** = allow-list includes `https://boostboss.ai/**` (you already have this)

---

## SMTP — Custom sender (Resend)

Already configured. Sender appears as **Boost Boss** `<noreply@boostboss.ai>` on all 4 templates above. If you ever need to reconfigure:

- **Supabase Dashboard → Authentication → Emails → SMTP Settings**
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key (from `resend.com/api-keys`)
- Sender email: `noreply@boostboss.ai`
- Sender name: `Boost Boss`

---

## Logo asset

Lives at `public/email-logo.png` in the boostboss repo. The actual file is the 480×480 rocket b-mark (overshoots the displayed 56×56 size for high-DPI screens — looks sharp on retina). Reachable at `https://boostboss.ai/email-logo.png` after deploy.

If you ever change the brand mark, replace this file in `public/` and the next email will pick it up automatically — no template edits needed.

---

**Templates not customized (Supabase defaults stay):**

- **Invite user** — not used; you don't call `admin.inviteUserByEmail()`
- **Magic link / OTP** — not used; you don't offer passwordless login
- **Reauthentication** — not used; you use your own TOTP 2FA via `api/auth.js`

These never fire from your app, so users never see Supabase's defaults for them. Skip safely.

---

**Last updated:** 2026-06-11
**Related memory:** `[[intent_accuracy_moat]]`, `[[publisher_outreach_playbook]]`
