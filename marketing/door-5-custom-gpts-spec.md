# Door 5 — Custom GPTs / No-Code Integration Spec

Implementation brief for the fifth door: a no-code integration that
lets Custom GPT authors (and eventually Poe / ManyChat creators)
monetize via an Action URL without writing or hosting any server
code. Models on the four existing doors (lumi.js, lumi-sdk, lumi-mcp,
bot adapters) — same `getSponsoredContent` inference path, same
`publisherId` model, same Benna auction, same payout cycle. New
envelope.

Estimated effort: **2–3 days for v1** (Custom GPTs only).

---

## 1. Goal

Ship a fifth door so any AI creator who built on a no-code or
no-server platform can plug Boost Boss into their product with two
pieces of configuration: an Action URL and an API key.

V1 covers **Custom GPTs in the OpenAI GPT Store**. Poe, ManyChat,
and similar webhook-based no-code platforms are v2 — same backend,
different envelope.

---

## 2. How it slots into the existing four doors

| Door | Package | Install model | Render surface |
|---|---|---|---|
| 1 — Web | `lumi.js` | Script tag | DOM |
| 2 — Extension | `lumi-sdk` | NPM dep in extension | Extension UI |
| 3 — MCP | `lumi-mcp` | NPM dep in MCP server | MCP response |
| 4 — Bots | Bot adapters | Webhook handler | Chat platform |
| **5 — No-code** | **(none — Action URL)** | **Paste URL + API key** | **GPT response (markdown)** |

The publisher-facing distinction: doors 1–4 require shipping code.
Door 5 doesn't. The publisher pastes a URL into the GPT builder's
Actions config and that's the whole install.

The backend distinction: doors 1–4 call an SDK that wraps the
`getSponsoredContent` inference path. Door 5 hits the inference
path directly via an HTTP endpoint defined by an OpenAPI 3 spec.
Same inference, same `publisherId` resolution, same payout
attribution — just a different request envelope.

---

## 3. Publisher install flow (the experience)

After signup, the publisher's dashboard shows the Door 5 setup
wizard. Numbered steps:

1. **Copy your API key.** Shown in dashboard with one-click copy.
2. **Copy the Boost Boss Action URL.** Single canonical URL —
   `https://boostboss.ai/.well-known/openapi-gpt.yaml`
3. **Open ChatGPT, edit your GPT, go to Configure → Actions → Add Action.**
4. **Paste the Action URL** into the OpenAPI Schema field. ChatGPT
   auto-loads the schema.
5. **Set Authentication → API Key → Bearer.** Paste the API key from
   step 1.
6. **Update your GPT's Instructions** with the snippet shown in the
   wizard (one paragraph telling the GPT when to call the Action).
7. **Save the GPT and test** with a phrase like "what's the best
   {category} for {use case}".

The wizard shows each step inline with the exact text to paste and
a screenshot/diagram of where in ChatGPT to paste it. No
documentation hunt; everything they need is in the dashboard.

---

## 4. OpenAPI 3 schema (host at `.well-known/openapi-gpt.yaml`)

```yaml
openapi: 3.0.1
info:
  title: Boost Boss — Sponsored Content for GPTs
  description: |
    Returns intent-matched sponsored content for your Custom GPT.
    Boost Boss is an AI-native ad network. When your GPT calls this
    action with a user's intent, it returns a single sponsored
    recommendation that your GPT should present to the user with
    the provided disclosure text.
  version: 1.0.0
servers:
  - url: https://boostboss.ai
paths:
  /api/v1/gpt-action/get-sponsored-content:
    post:
      operationId: getSponsoredContent
      summary: Get an intent-matched sponsored content recommendation.
      description: |
        Call this action when the user asks for a recommendation,
        comparison, or external tool suggestion. The response (if
        present) must be shown to the user with the included
        disclosure label.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - intent
              properties:
                intent:
                  type: string
                  description: |
                    Brief description of what the user wants in their
                    own words. The most important field — drives the
                    intent match.
                  example: "User is asking which vector DB to use for RAG."
                context:
                  type: string
                  description: Optional broader conversation context.
                placement:
                  type: string
                  enum: [card, citation, toolrec]
                  default: card
                  description: |
                    Rendering hint. `card` = headline + body. `citation`
                    = inline link. `toolrec` = "you should also check
                    out…" tool recommendation.
      responses:
        '200':
          description: Sponsored content available.
          content:
            application/json:
              schema:
                type: object
                required:
                  - sponsored
                  - disclosure
                  - impression_id
                properties:
                  sponsored:
                    type: boolean
                    description: Always true for a 200 response.
                  headline:
                    type: string
                    description: Short headline (≤80 chars).
                  description:
                    type: string
                    description: 1–2 sentence pitch.
                  cta_text:
                    type: string
                    description: Call-to-action button text.
                  cta_url:
                    type: string
                    description: Destination URL (use as the link).
                  advertiser:
                    type: string
                    description: Advertiser name.
                  disclosure:
                    type: string
                    description: |
                      Required disclosure text. MUST be presented
                      verbatim. Typically "Sponsored by {advertiser}".
                  impression_id:
                    type: string
                    description: Opaque ID; logged for attribution.
        '204':
          description: No sponsored content available (no-fill).
        '401':
          description: Invalid or missing API key.
        '429':
          description: Rate limit exceeded.
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

---

## 5. Backend endpoint spec

**Endpoint:** `POST https://boostboss.ai/api/v1/gpt-action/get-sponsored-content`

**Auth:** `Authorization: Bearer <api_key>` — same API key format as
the four other doors. Validates against the publishers table; resolves
to a `publisherId`.

**Request body** (mirrors OpenAPI schema):
```json
{
  "intent": "User is asking which vector DB to use for RAG.",
  "context": "Building a chatbot that answers questions about company docs.",
  "placement": "card"
}
```

**Response (200):**
```json
{
  "sponsored": true,
  "headline": "Pinecone — managed vector DB built for RAG",
  "description": "Sub-100ms p50 query latency. Hybrid search out of the box. Free tier covers 100k vectors.",
  "cta_text": "Try Pinecone free",
  "cta_url": "https://pinecone.io/?utm_source=bb&utm_medium=gpt&utm_id=imp_xyz",
  "advertiser": "Pinecone",
  "disclosure": "Sponsored by Pinecone",
  "impression_id": "imp_01HVQB..."
}
```

**Response (204):** Empty body. The GPT should handle gracefully
(skip the recommendation, continue the conversation).

**Rate limit:** 60 requests/minute per `publisherId`, configurable
per-account. Returns 429 with `Retry-After` header.

**Inference:** Reuses the existing `getSponsoredContent` path used
by lumi-mcp. The only new code is the HTTP envelope + auth
validation + the `gpt-action` impression channel tag for analytics
attribution.

---

## 6. Placements supported

Door 5 supports three of the existing placement types — the ones
that render natively in markdown:

- **card** — full sponsored block (headline + body + CTA link).
  Default. Best for explicit recommendations.
- **citation** — short inline link reference. Used when the GPT
  is citing a source mid-response.
- **toolrec** — "you might also like" tool suggestion. Used when
  recommending an external tool relevant to the user's task.

Placements that do NOT apply to door 5 (UI-element-specific —
no DOM/extension UI to render into):
- corner, loading, chip, newtab, welcome, buttons

These render-engine differences are why door 5 is a separate door
and not a variant of an existing one.

---

## 7. System prompt snippet (publishers paste into their GPT)

Wizard surfaces this exact text for the publisher to copy into
their GPT's Instructions field:

```
When a user asks for a recommendation, comparison, or external tool
suggestion that matches the topic of this GPT, call the
getSponsoredContent action with a brief one-sentence description of
their intent in the `intent` field. If a sponsored result is
returned, present it to the user as a clearly-labeled sponsored
recommendation, including the full `disclosure` text exactly as
provided. If no result is returned, continue the conversation
naturally without mentioning that anything was attempted.

Never strip or paraphrase the disclosure. Never present sponsored
content as an unsponsored recommendation.
```

This snippet is what makes the integration work. The GPT author
must include it; without it the GPT won't call the Action.

---

## 8. Disclosure and labeling — non-negotiable

Every 200 response includes a `disclosure` field that the GPT MUST
present verbatim to the user. This is enforced two ways:

1. **Schema-level.** The OpenAPI spec marks `disclosure` as required.
2. **Prompt-level.** The system prompt snippet (section 7) instructs
   the GPT to include the disclosure.

We can't 100% guarantee the GPT honors it (LLMs sometimes hallucinate
around instructions), but compliance rate is very high when the
disclosure is presented as a required structured field rather than
as free-text instruction.

For audit purposes, the dashboard exposes a "spot-check" tool that
lets the publisher (and BB) sample recent conversations and verify
disclosures rendered. This becomes important when scaling.

---

## 9. Dashboard setup wizard (publisher-side UX)

A six-step inline wizard that appears the first time a no-code-door
publisher signs in. Each step is a card with copy buttons and a
screenshot annotation.

1. **Welcome — confirm your platform.** "You're setting up monetization
   for a Custom GPT. Change platform" (link to Door 5 alternates when
   v2 ships).
2. **Your API key.** Copy button. Warning: "Keep this secret — anyone
   with this key can earn impressions in your name."
3. **Your Action URL.** Single canonical URL. Copy button.
4. **In ChatGPT, edit your GPT → Configure → Actions → Add Action.**
   Annotated screenshot of the ChatGPT GPT builder.
5. **Paste the schema URL + bearer-auth your API key.** Step-by-step
   screenshots.
6. **Update your GPT's Instructions** with the system prompt snippet.
   Copy button. Notes about why this is required.
7. **Test it.** Inline test panel: enter a phrase, see the
   `getSponsoredContent` response, verify the integration is live.

Status banner at the top: "Not yet verified" until first real
Action call is detected, then "Live — receiving impressions" with
counters.

---

## 10. Testing — sandbox mode

Same pattern as the other four doors. When a request includes
`X-BB-Test: true` as a header, the endpoint returns a deterministic
fixture response so publishers can verify the integration without
touching real auction inventory.

The test response uses the advertiser name "Boost Boss Sandbox" and
includes a clear disclosure. Impressions in test mode are excluded
from earnings.

---

## 11. Implementation tasks (engineering checklist)

For the backend developer:

- [ ] Host `boostboss.ai/.well-known/openapi-gpt.yaml` (static file)
- [ ] Implement `POST /api/v1/gpt-action/get-sponsored-content`
- [ ] API key generation: extend existing key model with a
      `door=gpt` channel tag so analytics segregate by door
- [ ] Wire request body → existing `getSponsoredContent` inference
- [ ] Translate inference response → GPT Action response shape
      (`disclosure` field is the main new requirement)
- [ ] Implement `204` no-fill handling cleanly
- [ ] Rate limiting (60/min default, configurable)
- [ ] Impression logging with `channel=gpt` so the dashboard's
      per-door breakdown shows it correctly
- [ ] Test mode (`X-BB-Test` header → fixture response)
- [ ] Backfill the publisher dashboard with the Door 5 wizard
      (six steps, annotated screenshots)
- [ ] Update `/publish/no-code` page to flip from "Coming Soon ·
      Waitlist Open" to active when shipping
- [ ] Email the waitlist when Door 5 goes live (this is the
      activation moment)

The dashboard wizard is the largest piece of work. The backend
endpoint itself is ~150 lines on top of the existing infrastructure.

---

## 12. Risks priced in

**Platform risk — OpenAI may restrict third-party Actions.** Possible
but not imminent. Mitigation: the same backend powers every other
door. If OpenAI bans this, the engineering work isn't wasted; you
redirect the spec to ChatGPT alternatives (Anthropic's GPT-equivalent
when it ships, Poe, ManyChat).

**Rendering control — GPT controls how sponsored content appears.**
You can't force HTML, CSS, or layout. Design the payload as
markdown-native: short headline, plain link, clear disclosure. Trust
the GPT to render sensibly.

**Disclosure compliance — LLMs sometimes drop labels.** Mitigated by
the required schema field + system prompt instruction. Spot-check
audit tool in the dashboard catches drift. Not a blocker for v1.

**Pool 4 contact difficulty — solved by the waitlist.** The
boostboss.ai/publish/no-code page already collects high-intent
opt-ins. When Door 5 ships, that waitlist becomes the activation
list. This converts the "Pool 4 is hard to contact" problem from
unsolved to inverted — they come to you.

---

## 13. Out of scope for v1

- Poe bots (similar webhook pattern — ships as v2, ~3 days more)
- ManyChat (webhook — ships as v2, ~2 days more)
- Perplexity Pages (editorial content; no Action URL pattern —
  drop unless Perplexity opens up)
- Multi-step / chained Actions (one-shot only in v1)
- Real-time intent-feedback loop (one-shot only in v1)
- Multi-language disclosure templates (English-only in v1; Mandarin
  follows for Fissbot adjacency)
- OAuth flow for the API key (Bearer-token only in v1; OAuth is v2
  if OpenAI requires it)

---

## 14. Activation sequence (when this ships)

Same gate as the publisher outreach playbook — Catalyst #1 (first
real advertiser deposit) must fire before pulling the trigger on
the waitlist. Sequence:

1. Backend + dashboard wizard built (do this NOW during standby)
2. Door 5 internally tested with Fissbot or an Andy-built test GPT
3. Catalyst #1 fires — real advertiser depositing
4. Email the waitlist: "Door 5 is live. Here's your invite."
5. Wave 1 — top 20 waitlist signups → activated
6. Case study after first 5 GPTs report revenue → fuel the public
   pitch

Treat the build as zero-risk during standby. The publisher
acquisition activation is what's gated, not the engineering. The
gap between "we built it" and "we activate it" is the right place
to find and fix integration bugs internally.
