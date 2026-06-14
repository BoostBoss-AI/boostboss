# MCP Publisher Prospect Scraper — Build Brief

A freelancer-ready spec for building the prospect-data pipeline that
feeds Boost Boss's publisher outreach. Scope: scrape the five main MCP
catalogs, enrich GitHub-handle → email, normalize into one prospect
sheet, run weekly.

Estimated effort for a competent Python freelancer: **3–5 days for
v1, 1 day/month for maintenance**.

---

## Goal

Produce and maintain a single deduped CSV/Google-Sheet of MCP server
maintainers with enough data to (a) prioritize outreach and (b)
write personalized cold emails. Target dataset: ~3,000 unique
maintainers covering the most-installed MCP servers across the
ecosystem.

---

## Output schema (single source of truth)

One row per **unique maintainer**, not per server. A maintainer may
own multiple servers — merge them.

| Field | Type | Notes |
|---|---|---|
| `prospect_id` | uuid | Stable identifier across re-runs |
| `maintainer_name` | string | Display name from GitHub profile |
| `github_username` | string | The slug, e.g. `anthropics` |
| `github_profile_url` | url | `https://github.com/{username}` |
| `email_primary` | string | Best-confidence email (see enrichment rules) |
| `email_source` | enum | `github_public` \| `git_log` \| `hunter` \| `apollo` \| `manual` |
| `email_confidence` | float | 0.0–1.0 (see scoring rules below) |
| `servers` | json array | List of server names this maintainer owns |
| `server_count` | int | `length(servers)` |
| `total_installs` | int | Sum across all their servers (Smithery + Glama, deduped) |
| `top_server_name` | string | Their highest-install server |
| `top_server_repo` | url | GitHub repo for top server |
| `top_server_description` | string | One-line description, ≤200 chars |
| `top_server_tags` | json array | Categories — `vector-db`, `coding`, `productivity`, etc. |
| `last_commit_date` | date | Most recent commit across their MCP repos |
| `recency_bucket` | enum | `active` (<30d) \| `recent` (30–90d) \| `stale` (90d+) |
| `listed_on` | json array | Subset of `[smithery, glama, mcp_so, pulsemcp, registry]` |
| `catalog_count` | int | `length(listed_on)` |
| `traction_score` | float | Computed — see scoring formula |
| `language_locale` | enum | `en` \| `zh` \| `ja` \| `ko` \| `other` (best-guess from README) |
| `status` | enum | `new` \| `queued` \| `contacted` \| `replied` \| `integrated` \| `dead` |
| `last_contact_date` | date | NULL until first outreach |
| `notes` | string | Freeform |
| `date_first_seen` | datetime | First time this maintainer appeared |
| `date_last_updated` | datetime | Last enrichment pass |

---

## Per-source extraction specs

### 1. Smithery (smithery.ai)

- **Try API first.** Smithery exposes a public REST API for browsing
  servers — endpoint structure roughly `https://smithery.ai/api/servers`
  with pagination params. Inspect the network tab on
  `smithery.ai/servers` to confirm the live endpoint shape.
- **Auth.** Some endpoints may require a free API key — sign up, copy
  key, send as `Authorization: Bearer <key>` header.
- **Rate limit.** Default to 1 req/sec to be polite; respect
  `429 Too Many Requests` with exponential backoff.
- **Fields to extract per server:**
  - `name`, `description`, `repo_url`, `install_count`, `category_tags`,
    `created_at`, `updated_at`, `author_github_username`
- **Pagination cap.** Pull top 500 servers by `install_count` for v1.
  Full catalog can be a v2 follow-up.

### 2. Glama (glama.ai/mcp)

- **Has a public API.** Endpoint `https://glama.ai/api/mcp/v1/servers`
  (verify current path) returns paginated JSON with rich metadata.
- **Auth.** Anonymous read access for most endpoints; check for an
  Authorization requirement and create an account if needed.
- **Rate limit.** 1 req/sec default. Glama's catalog is large (~21k)
  so this matters.
- **Fields to extract per server:**
  - `name`, `description`, `repo_url`, `stars`, `last_commit`,
    `categories`, `language`, `author_github_username`
- **Pagination cap.** Top 1,000 by stars or installs for v1.

### 3. mcp.so

- **No public API confirmed.** Default to HTML scraping.
- **Approach.** Use `playwright` (not `requests`) because the page is
  JS-rendered. Iterate through `/servers?page=N` until empty.
- **Selectors (verify before implementation — these are placeholders).**
  - Server card: `[data-server-card]` or `.server-card` (inspect DOM)
  - Server name: `h3` inside card
  - Description: `p` inside card
  - Link to detail page: `a[href^="/server/"]`
- **Detail page fields.** Visit each server's detail page; extract repo
  URL, author handle, tags, description, sponsor flag (Y/N — the
  "Sponsor" tag on the homepage means a paid placement).
- **Rate limit.** 1 req/2sec. mcp.so is community-run; don't burn it.
- **Locale.** Tag servers with non-English README as `language_locale=zh`
  for Fissbot-relevant outreach.

### 4. PulseMCP (pulsemcp.com)

- **RSS / JSON feed.** PulseMCP publishes a feed of newly-listed
  servers. Inspect the site footer for the feed URL or check
  `/feed.xml`. This is the cleanest source for **delta updates** week
  over week.
- **Catalog scrape.** For the historical catalog, scrape
  `pulsemcp.com/servers` paginated. Selectors TBD on inspection.
- **Curator metadata.** PulseMCP adds editorial quality scores or
  "featured" tags — capture these if present, they're a quality signal.

### 5. Official MCP Registry (registry.modelcontextprotocol.io)

- **Anthropic-maintained, has a structured API.** Likely a `/api/v1/servers`
  endpoint returning JSON. Schema is well-defined.
- **Auth.** None for read access.
- **Use case.** Cross-reference — anything listed on the official
  registry gets +bonus in `traction_score` (signals the maintainer
  cared enough to submit officially).

---

## Email enrichment pipeline

For each unique GitHub username, run in order until an email is found.
Record `email_source` and `email_confidence` for each hit.

### Step 1 — GitHub profile public email
- Hit `https://api.github.com/users/{username}` (no auth needed for
  60 req/hr; with a free token, 5,000 req/hr).
- Field: `email`. Often null but ~30% of devs expose it.
- `email_confidence = 0.95`, `email_source = github_public`.

### Step 2 — Commit log of their top server's repo
- `git clone --depth 100 <repo_url>` (shallow clone — fast).
- `git log --format='%aN <%aE>' --no-merges | sort -u`
- Filter out `@users.noreply.github.com` (GitHub's anonymizer).
- Match committer emails to the maintainer's display name.
- `email_confidence = 0.85` if the email's display name matches the
  GitHub `name` field; `0.65` otherwise.
- `email_source = git_log`.

### Step 3 — Hunter.io fallback
- API call `hunter.io/v2/email-finder?domain={extracted}&first_name=X&last_name=Y`
  using the parts of `maintainer_name`.
- Domain extraction: if the maintainer's profile lists a personal
  domain (`blog`, `website` fields on the GitHub profile), use that.
  Otherwise skip Hunter.
- `email_confidence = response.score / 100`
- `email_source = hunter`.

### Step 4 — Apollo / Clay fallback
- For high-value prospects (`traction_score > threshold`) with no
  email after the above, push into Apollo or Clay for manual-review
  enrichment.
- `email_confidence = 0.50` (lower because heavier inference).

---

## Deduplication and merge logic

After all sources are scraped:

1. **Server-level dedup.** Group server records by `repo_url`. Same
   repo listed on multiple catalogs → one server record with merged
   `listed_on` array.

2. **Maintainer-level merge.** Group server records by
   `github_username`. One row per maintainer with their servers
   aggregated.

3. **Conflict resolution.** When two sources disagree on a field
   (e.g., different `install_count`), prefer the source most recently
   updated, and store the per-source value in a sub-field for audit.

4. **Status preservation.** Re-runs must NOT overwrite the `status`,
   `last_contact_date`, or `notes` fields — those are owned by the
   outreach workflow, not the scraper.

---

## Traction scoring formula

A simple weighted formula to rank prospects for outreach order:

```
traction_score =
    log10(total_installs + 1)         × 4.0   # primary signal
  + log10(top_server_stars + 1)       × 2.0   # github traction
  + recency_bonus                     × 3.0   # active maintainer
  + multi_catalog_bonus               × 2.0   # listed broadly
  + official_registry_bonus           × 2.0   # in Anthropic registry
  + multi_server_bonus                × 1.0   # serial builder

where:
  recency_bonus      = 1.0 if active, 0.5 if recent, 0.0 if stale
  multi_catalog_bonus = min(catalog_count / 3, 1.0)
  official_registry  = 1.0 if "registry" in listed_on, else 0.0
  multi_server_bonus = min(server_count / 3, 1.0)
```

Sort the final sheet by `traction_score` descending. Outreach starts
at the top.

---

## Tech stack options

Pick one based on freelancer comfort and budget:

### Option A — Pure Python, run locally (cheapest)
- `requests` + `httpx` for APIs
- `playwright` for JS-rendered pages (mcp.so)
- `pandas` for normalization + dedup
- Output to CSV + Google Sheets via `gspread`
- Costs: $0 software, ~$5/mo for a small VPS to run weekly cron
- Time: 3–5 days

### Option B — Apify (middle ground)
- Apify hosts existing actors for many directories — check the Apify
  Store for `mcp` or directory-specific actors before writing custom.
- Write custom actors for sites without existing coverage.
- Apify handles scheduling, proxy rotation, retries.
- Costs: ~$49–99/mo depending on volume.
- Time: 2–3 days.

### Option C — Clay (no-code, fastest)
- Clay's UI lets you point at URLs, define columns, and chain
  enrichments (GitHub → Hunter → Apollo).
- Best if the freelancer is a growth-ops person, not a dev.
- Costs: ~$149+/mo.
- Time: 1–2 days.

**Recommendation.** Start with Option A for v1 — full control, lowest
recurring cost, all custom code is reusable. Migrate hot paths to
Apify if maintenance becomes a burden.

---

## Storage + access

- **Working store.** A single Google Sheet titled
  `bb-publisher-prospects-mcp` with the schema above. One sheet per
  ecosystem (MCP, AI apps, Discord bots, custom GPTs) for v2.
- **Backup.** Mirror to CSV in a private GitHub repo or S3 bucket.
  One file per run, datestamped, so historical state is queryable.
- **Audit columns.** Keep `date_first_seen` and `date_last_updated`
  on every row so you can answer "when did we first know about this
  maintainer."

---

## Cadence

- **Initial bulk run.** One time, ~6 hours wall-clock to scrape all
  five sources + initial enrichment.
- **Weekly delta.** Re-pull each source's "recently added" or
  "recently updated" feed. Merge new records into the sheet without
  touching outreach status fields.
- **Monthly re-enrichment.** For prospects with `email_confidence <
  0.6`, re-attempt enrichment. Hunter/Apollo improve over time.
- **Quarterly full refresh.** Re-scrape everything to catch
  removed/abandoned listings.

---

## Politeness + legal

- **Respect robots.txt.** Check each site's `/robots.txt` before
  scraping; honor `Disallow` directives.
- **Set a real User-Agent.** Something like
  `BoostBoss-Prospector/1.0 (+https://boostboss.ai/about-bot)` —
  identifies you, points to a contact page. Sites that block
  scrapers usually let through identified ones.
- **Rate limit conservatively.** 1 req/sec is the default; some
  community-run sites (mcp.so, PulseMCP) get 1 req/2sec.
- **Don't bypass auth.** Only scrape public-facing pages and
  public-facing APIs. No login walls, no rate-limit circumvention.
- **Scope: public business data.** Names + GitHub handles + public
  emails. Don't collect anything personal beyond what's on the
  public profile.

---

## Acceptance criteria (how the freelancer knows they're done)

V1 ships when:

- [ ] Single Google Sheet exists, schema matches above, ≥2,500 unique
      maintainer rows
- [ ] ≥80% of rows have `email_primary` filled with confidence ≥0.6
- [ ] `traction_score` populated, sheet is sortable
- [ ] Top 100 by `traction_score` spot-checked manually — emails work,
      repo URLs resolve, install counts match the source catalog
- [ ] Re-running the scraper produces 0 duplicates and preserves the
      `status` / `last_contact_date` columns
- [ ] Weekly cron is scheduled and posts a delta-summary to Slack /
      email after each run
- [ ] README in the repo documents how to run it, where the secrets
      live, and how to add a new source

---

## Out of scope for v1

- Pool 2 (AI app builders), Pool 3 (Discord bots), Pool 4 (custom
  GPTs) — separate scrapers, ship after MCP pipeline is stable
- Outbound email sending — that's a separate tool (Apollo, Smartlead,
  Instantly)
- Reply tracking / CRM workflow — a downstream concern, not the
  scraper's job
- Multi-language email enrichment — v1 ships English-language flows
  only; mcp.so Chinese-language maintainers are flagged
  (`language_locale=zh`) and held for a dedicated Mandarin pipeline

---

## Files to deliver

The freelancer ships:

1. A private GitHub repo containing the scraper code
2. A README explaining setup + run + schedule
3. The seeded Google Sheet with v1 data
4. A short Loom / written handoff (≤30 min) walking through the
   architecture and where to extend it
