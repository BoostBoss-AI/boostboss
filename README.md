# Boost Boss

The MCP-powered ad network for AI-native applications.

**Four pillars:**

- **Lumi SDK** — Publisher monetization SDK. Drop a script tag or call the MCP server to serve contextual ads inside any AI app.
- **SuperBoost** — Self-serve advertiser platform. Create campaigns, set budgets, and target by intent, MCP tool, host app, and region.
- **BBX** — Programmatic exchange. OpenRTB 2.6 compliant first-price auctions for DSPs, agencies, and trading desks.
- **Benna AI** — Optimization engine. Scores every bid in real time using MCP signals (intent, tool, host, session length, region).

## Architecture

9 serverless functions on Vercel with dual-mode architecture:

| API | Purpose |
|-----|---------|
| `/api/mcp` | JSON-RPC 2.0 MCP server (Lumi SDK) |
| `/api/rtb` | OpenRTB 2.6 exchange (BBX) |
| `/api/benna` | Benna AI inference + engine status |
| `/api/campaigns` | Campaign CRUD, review queue, pause/resume |
| `/api/track` | Event tracking (impression, click, close, video_complete, skip) |
| `/api/billing` | Stripe Checkout deposits, Connect payouts, transaction history |
| `/api/auth` | JWT authentication (signup, login, demo) |
| `/api/stats` | Reporting + daily ETL aggregation |
| `/api/stripe-webhook` | Stripe webhook relay |

Every endpoint works in two modes: **Production** (Supabase + Stripe) and **Demo** (in-memory stores, zero external deps). The demo mode produces real traceable numbers — same response shapes, same budget enforcement, same Benna scoring.

## Quick Start

```bash
# Clone and install
git clone https://github.com/andydasouth/boostboss.git
cd boostboss
npm install

# Run tests (no env vars needed — everything runs in demo mode)
npm test

# Local dev server (requires Vercel CLI)
npx vercel dev
```

Open `http://localhost:3000/demo` to see the SDK demo with live Benna scoring.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

**Required for production:**

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | 32+ char random string for HMAC-signed JWTs |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `BOOSTBOSS_BASE_URL` | Public URL (e.g., `https://boostboss.ai`) |

**Optional:**

| Variable | Default | Description |
|----------|---------|-------------|
| `BBX_RTB_FEE` | `0.065` | Demand-side RTB exchange fee (charged to advertiser) |
| `BBX_NETWORK_TAKE` | `0.235` | Boost Boss network take (platform margin) |
| `BBX_TAKE_RATE` | _legacy_ | If set, overrides `BBX_RTB_FEE + BBX_NETWORK_TAKE` (back-compat) |
| `BBX_MIN_PAYOUT` | `100` | Minimum payout threshold (USD) |
| `BBX_SEAT_AUTH_REQUIRED` | `false` | Require Bearer auth on RTB POST |

## Database Setup (Supabase)

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `db/deploy.sql` in the SQL Editor to create tables, RPCs, and indexes
3. Enable `pg_cron` extension: `create extension if not exists pg_cron with schema extensions;`
4. Schedule daily jobs (commands are in `db/deploy.sql` comments):
   - Daily spend reset: `0 0 * * *` UTC
   - Stats aggregation: `5 0 * * *` UTC

## Deployment (Vercel)

```bash
# Link to Vercel project
npx vercel link

# Set environment variables
npx vercel env add SUPABASE_URL
npx vercel env add SUPABASE_ANON_KEY
# ... etc

# Deploy
git push origin main
```

The project auto-deploys on push via Vercel Git integration.

## Tests

```bash
npm test
```

Runs 142 tests across 6 test suites: auth, RTB, billing, campaigns, track, and MCP. All tests run in demo mode (no external services needed).

## Project Structure

```
api/            — Vercel serverless functions
public/         — Static files (HTML pages, SDK, IAB compliance)
  sdk.js        — Lumi SDK (drop-in publisher script)
  demo.html     — Interactive SDK demo with Benna inspector
  advertiser.html — SuperBoost advertiser dashboard
  developer.html  — Lumi publisher dashboard
  admin.html    — Campaign review admin panel
  exchange.html — BBX exchange marketing page
  playground.html — API playground
  status.html   — Service health dashboard
  docs.html     — API documentation
  openapi.json  — OpenAPI 3.1 spec
  sellers.json  — IAB sellers.json
  ads.txt       — IAB ads.txt
db/             — Database migrations
tests/          — Test suites
```

## Revenue Model

- **Demand-side RTB exchange fee:** 6.5% of cleared spend, charged to the advertiser (`BBX_RTB_FEE`)
- **Network take:** 23.5% of cleared spend, Boost Boss platform margin (`BBX_NETWORK_TAKE`)
- **Publisher share:** 70% of cleared spend
- **Legacy:** `BBX_TAKE_RATE` env var, if set, overrides the sum of the two new vars
- **Benna API licensing:** $0.002/inference for third-party mediation stacks

## Links

- Production: [boostboss.ai](https://boostboss.ai)
- Benna AI: [benna.ai](https://benna.ai)
- API Docs: [boostboss.ai/docs](https://boostboss.ai/docs)
- OpenAPI Spec: [boostboss.ai/openapi.json](https://boostboss.ai/openapi.json)
