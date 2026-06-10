# Boost Boss — Supabase Email Templates

Paste these HTML templates into **Supabase Dashboard → Authentication → Email Templates** to deliver branded confirmation, password reset, and email change messages instead of Supabase's generic defaults.

**Required:** Custom Domain (auth.boostboss.ai) must be active. Already done.

**Recommended (but optional today):** Custom SMTP sender. Without custom SMTP, Supabase sends from a generic Supabase address with strict rate limits (3-4 emails/hour for testing). For production, see "Custom SMTP" section at the bottom.

---

## How to apply

For each template below:

1. Open **Supabase Dashboard → Authentication → Email Templates**
2. Click the template type tab (Confirm signup / Reset Password / etc.)
3. Replace the entire HTML in the right-side editor with the version below
4. **Important**: keep the `{{ .ConfirmationURL }}` template variable exactly as written — Supabase substitutes the real link at send time
5. Update the **Subject** line at the top of each template
6. Click **Save**

Test by triggering the flow (sign up with a fresh email) and inspecting the actual email you receive.

---

## 1. Confirm signup

**Subject:** `Confirm your Boost Boss account`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; }
  .wrap { max-width: 540px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo { font-size: 36px; line-height: 1; margin-bottom: 8px; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 24px; color: #1A1A2E; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; }
  p { font-size: 15.5px; line-height: 1.6; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 28px 0; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 10px; text-decoration: none; }
  .btn:hover { background: #E01E65; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">🚀</div>
      <div class="brand">Boost Boss</div>

      <h1>Confirm your email</h1>
      <p>Welcome to Boost Boss. Click the button below to activate your account.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm email</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#FF2D78; text-decoration:underline;">{{ .ConfirmationURL }}</a>
      </p>

      <hr class="divider">

      <p class="foot">
        If you didn't sign up for Boost Boss, you can safely ignore this email.<br><br>
        Questions? <a href="mailto:support@boostboss.ai">support@boostboss.ai</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Reset Password

**Subject:** `Reset your Boost Boss password`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; }
  .wrap { max-width: 540px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo { font-size: 36px; line-height: 1; margin-bottom: 8px; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 24px; color: #1A1A2E; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; }
  p { font-size: 15.5px; line-height: 1.6; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 28px 0; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 10px; text-decoration: none; }
  .btn:hover { background: #E01E65; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; }
  .foot a { color: #FF2D78; text-decoration: none; }
  .warn { background: #FFF7E6; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px 14px; font-size: 13.5px; color: #B97309; margin: 0 0 20px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">🔑</div>
      <div class="brand">Boost Boss</div>

      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your Boost Boss account. Click the button below to choose a new one.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Reset password</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#FF2D78; text-decoration:underline;">{{ .ConfirmationURL }}</a>
      </p>

      <div class="warn">
        ⏱ This link expires in 1 hour. If it expires before you use it, request a new one from the sign-in page.
      </div>

      <hr class="divider">

      <p class="foot">
        If you didn't request a password reset, you can safely ignore this email — your password won't change.<br><br>
        Questions? <a href="mailto:support@boostboss.ai">support@boostboss.ai</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Change Email Address

**Subject:** `Confirm your new Boost Boss email`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #FAFAF7; color: #1A1A2E; }
  .wrap { max-width: 540px; margin: 40px auto; padding: 0 24px; }
  .card { background: #FFFFFF; border: 1px solid #EAEAEF; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  .logo { font-size: 36px; line-height: 1; margin-bottom: 8px; }
  .brand { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 24px; color: #1A1A2E; }
  h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 16px; color: #1A1A2E; }
  p { font-size: 15.5px; line-height: 1.6; color: #4B4B5E; margin: 0 0 16px; }
  .btn-wrap { margin: 28px 0; text-align: center; }
  .btn { display: inline-block; background: #FF2D78; color: #FFFFFF !important; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 10px; text-decoration: none; }
  .btn:hover { background: #E01E65; }
  .fallback { font-size: 13px; color: #6B7280; word-break: break-all; line-height: 1.5; }
  .divider { height: 1px; background: #EAEAEF; margin: 32px 0; border: 0; }
  .foot { font-size: 13px; color: #6B7280; text-align: center; }
  .foot a { color: #FF2D78; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">✉️</div>
      <div class="brand">Boost Boss</div>

      <h1>Confirm your new email</h1>
      <p>Click the button below to finish changing the email address on your Boost Boss account.</p>

      <div class="btn-wrap">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm new email</a>
      </div>

      <p class="fallback">Or paste this URL into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#FF2D78; text-decoration:underline;">{{ .ConfirmationURL }}</a>
      </p>

      <hr class="divider">

      <p class="foot">
        If you didn't request this change, contact <a href="mailto:support@boostboss.ai">support@boostboss.ai</a> immediately — someone may have access to your account.
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Required Supabase setting toggles

Before any of this works, flip these toggles in **Supabase Dashboard → Authentication**:

1. **Sign In / Providers → Email → Confirm email**: **ON**
   - This is what makes `signUp()` send the confirmation email and gate login until confirmed.
   - Without this, the api/auth.js change won't trigger emails.

2. **Sign In / Providers → Email → Secure email change**: **ON**
   - Requires the user to confirm on BOTH the old and new email when changing addresses (defense against compromised account scenarios).

3. **URL Configuration → Site URL**: `https://boostboss.ai`
   - Used as the default redirect base when an `emailRedirectTo` isn't passed.

4. **URL Configuration → Redirect URLs**: add all these allow-list entries (one per line):
   ```
   https://boostboss.ai/ads/confirm
   https://boostboss.ai/publish/confirm
   https://boostboss.ai/ads/reset-password
   https://boostboss.ai/publish/reset-password
   ```
   - Supabase blocks emails with a `redirectTo` that doesn't match this allow-list. If a user clicks a confirmation link and gets an error, this is usually why.

---

## Custom SMTP (recommended for production)

By default, Supabase sends from `noreply@<auto>.supabase.co` with strict rate limits (~3-4 emails/hour on free, higher on Pro but still limited). For production publisher / advertiser signups you'll want a proper sender.

**Recommended provider: Resend** (`https://resend.com`)
- 3,000 emails/month free
- $20/mo for 50,000 emails after
- 1-line DNS setup (verify boostboss.ai domain)
- Send from `noreply@boostboss.ai`

**Setup:**

1. Sign up at resend.com with `admin@boostboss.ai`
2. Domains → Add Domain → `boostboss.ai` → copy the 3 DNS records (DKIM, SPF, return-path)
3. Add those records at Vercel DNS → boostboss.ai → wait for verification (~5 min)
4. API Keys → Create API key → copy
5. Supabase Dashboard → Authentication → SMTP Settings:
   - Enable Custom SMTP
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: paste the Resend API key
   - Sender email: `noreply@boostboss.ai`
   - Sender name: `Boost Boss`
6. Save and send a test email through Resend dashboard to verify

After this, all auth emails come from `noreply@boostboss.ai`, with `auth.boostboss.ai` links — fully branded end to end.

---

**Last updated:** 2026-06-10
**Related memory:** `[[intent_accuracy_moat]]`, `[[publisher_outreach_playbook]]`
**Activates after:** Andy enables "Confirm email" in Supabase project + pastes these templates.
