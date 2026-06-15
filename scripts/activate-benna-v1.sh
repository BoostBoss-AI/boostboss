#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Benna v1 activation — prime cache + embed campaigns + verify
#  ───────────────────────────────────────────────────────────────────
#  Runs the 3-call activation sequence documented in docs/benna-v1.md:
#    1. embed_stats          — sanity check (key + DB + dims)
#    2. embed_seed            — prime intent_embedding_cache from
#                               db/seed-embedding-tokens.json (~200 tokens,
#                               one Voyage batch call, ~$0.005)
#    3. reembed               — populate campaigns.intent_embedding for
#                               every active campaign that has target tokens
#    4. embed_stats (again)   — confirm cache_size went up
#
#  Required env (any ONE of these — script picks the first that's set):
#    BBX_ADMIN_KEY            — admin secret (newer name, used in benna-v1.md)
#    ADMIN_TOKEN              — admin secret (older name, used in
#                               launch-kit/phase-e-live-key-flip-runbook.md)
#    CRON_SECRET              — Vercel cron secret (requireAdminOrCron also
#                               accepts this as Bearer auth)
#  Optional env:
#    BBX_BASE_URL             — defaults to https://boostboss.ai
#    BBX_VERBOSE              — set to 1 to echo full JSON responses
#
#  Exits non-zero on any failure. Safe to re-run — embed_seed and
#  reembed are both idempotent (UPSERT-based).
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BBX_BASE_URL:-https://boostboss.ai}"
SEED_FILE="$(cd "$(dirname "$0")/.." && pwd)/db/seed-embedding-tokens.json"

# ── Colours ────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; DIM=$'\e[2m'; RESET=$'\e[0m'
else
  RED=""; GREEN=""; YELLOW=""; DIM=""; RESET=""
fi

ok()    { echo "${GREEN}✓${RESET} $1"; }
fail()  { echo "${RED}✗${RESET} $1" >&2; exit 1; }
info()  { echo "${DIM}  $1${RESET}"; }
title() { echo; echo "${YELLOW}▸ $1${RESET}"; }

# ── Pre-flight: pick whichever auth env var is set ─────────────────
AUTH_KEY=""
AUTH_NAME=""
if   [[ -n "${BBX_ADMIN_KEY:-}" ]]; then AUTH_KEY="$BBX_ADMIN_KEY"; AUTH_NAME="BBX_ADMIN_KEY"
elif [[ -n "${ADMIN_TOKEN:-}"   ]]; then AUTH_KEY="$ADMIN_TOKEN";   AUTH_NAME="ADMIN_TOKEN"
elif [[ -n "${CRON_SECRET:-}"   ]]; then AUTH_KEY="$CRON_SECRET";   AUTH_NAME="CRON_SECRET"
else
  fail "no auth env var set — try one of: BBX_ADMIN_KEY, ADMIN_TOKEN, CRON_SECRET"
fi
[[ -f "$SEED_FILE" ]] || fail "seed file not found at $SEED_FILE"
command -v jq >/dev/null 2>&1 || fail "jq required but not on PATH"
command -v curl >/dev/null 2>&1 || fail "curl required but not on PATH"

echo "Benna v1 activation → ${BASE_URL}"
echo "Auth source:         ${AUTH_NAME}"
echo "Seed file:           ${SEED_FILE}"

curl_get() {
  curl -sS -w '\n%{http_code}\n' \
    -H "Authorization: Bearer ${AUTH_KEY}" \
    "${BASE_URL}$1"
}

curl_post_json() {
  curl -sS -w '\n%{http_code}\n' -X POST \
    -H "Authorization: Bearer ${AUTH_KEY}" \
    -H "Content-Type: application/json" \
    --data-binary "$2" \
    "${BASE_URL}$1"
}

extract_body()   { sed '$d'; }
extract_status() { tail -n1; }

# ─── Step 1: embed_stats (pre) ─────────────────────────────────────
title "1. embed_stats — sanity check"
resp="$(curl_get "/api/campaigns?action=embed_stats")"
status="$(echo "$resp" | extract_status)"
body="$(echo "$resp" | extract_body)"
[[ "$status" == "200" ]] || fail "expected 200, got $status: $body"

cache_pre="$(echo "$body" | jq -r '.cache_size')"
miss_queue="$(echo "$body" | jq -r '.miss_queue')"
model="$(echo "$body" | jq -r '.model')"
dims="$(echo "$body" | jq -r '.dims')"

ok "auth ok, embedding stack reachable"
info "model:       $model ($dims dims)"
info "cache_size:  $cache_pre"
info "miss_queue:  $miss_queue"
[[ "${BBX_VERBOSE:-0}" == "1" ]] && echo "$body" | jq .

# ─── Step 2: embed_seed ────────────────────────────────────────────
title "2. embed_seed — prime cache from seed-embedding-tokens.json"
seed_body="$(cat "$SEED_FILE")"
token_count="$(echo "$seed_body" | jq '.tokens | length')"
info "seeding $token_count tokens..."

resp="$(curl_post_json "/api/campaigns?action=embed_seed" "$seed_body")"
status="$(echo "$resp" | extract_status)"
body="$(echo "$resp" | extract_body)"
[[ "$status" == "200" ]] || fail "expected 200, got $status: $body"

promoted="$(echo "$body" | jq -r '.promoted')"
failed="$(echo "$body" | jq -r '.failed')"
[[ "$failed" == "0" ]] || fail "$failed tokens failed to embed"
ok "$promoted tokens promoted into intent_embedding_cache"
[[ "${BBX_VERBOSE:-0}" == "1" ]] && echo "$body" | jq .

# ─── Step 3: reembed campaigns ─────────────────────────────────────
title "3. reembed — populate campaigns.intent_embedding"
resp="$(curl_post_json "/api/campaigns?action=reembed" "{}")"
status="$(echo "$resp" | extract_status)"
body="$(echo "$resp" | extract_body)"
[[ "$status" == "200" ]] || fail "expected 200, got $status: $body"

touched="$(echo "$body" | jq -r '.touched')"
skipped="$(echo "$body" | jq -r '.skipped')"
failed="$(echo "$body" | jq -r '.failed')"
total="$(echo "$body" | jq -r '.total')"
[[ "$failed" == "0" ]] || fail "$failed campaigns failed to embed"
ok "$touched/$total campaigns now have intent_embedding (skipped=$skipped, no target tokens)"
[[ "${BBX_VERBOSE:-0}" == "1" ]] && echo "$body" | jq .

# ─── Step 4: embed_stats (post) — confirm cache grew ───────────────
title "4. embed_stats — post-activation"
resp="$(curl_get "/api/campaigns?action=embed_stats")"
status="$(echo "$resp" | extract_status)"
body="$(echo "$resp" | extract_body)"
[[ "$status" == "200" ]] || fail "expected 200, got $status: $body"

cache_post="$(echo "$body" | jq -r '.cache_size')"
info "cache_size:  $cache_pre → $cache_post"

if [[ "$cache_post" -gt "$cache_pre" ]]; then
  ok "cache populated"
else
  echo "${YELLOW}⚠${RESET}  cache_size did not grow ($cache_pre → $cache_post) — investigate" >&2
  exit 1
fi

echo
echo "${GREEN}✓ Benna v1 activated.${RESET}"
echo "Next: run §4 SQL verification queries in Supabase (docs/benna-v1.md)"
echo "      to confirm cosine signal is appearing in auction_logs."
