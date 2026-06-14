# Reply-1 Template — After a "Yes" to the Cold Email

This is what you send back when an advertiser replies positively to
the cold email in `advertiser-cold-email.md`. The job of this email
is not to sell again — they already said yes. The job is to remove
every remaining friction between "yes" and "first bundle purchased."

Target outcome: a click on the invitation link → land on the signup
page → fund a Test bundle within 48 hours.

---

## Invitation link structure

Use **one canonical invite URL** that you'll embed in every reply.
Recommended structure:

```
https://boostboss.ai/ads/signup?invite=early&via={SOURCE}
```

Where `{SOURCE}` is short context — `pool1`, `producthunt`, `mcp_so`,
`smithery`, `cold_outreach`, etc. — for attribution. This is a single
landing page; the query params are for tracking, not gating.

### What that landing page must show

If `/ads/signup?invite=early` doesn't already feel different from the
plain signup, build a thin variant:

1. **Header strip**: "Early advertiser cohort — locked-in CPMs"
2. **Bundle ladder** (matches `bundle-pricing-page.md` exactly)
3. **Signup form** (same as normal, but the resulting account is
   tagged in the DB as `early_cohort=true` so you can pull cohort
   reports later)
4. **A one-line note**: "You're seeing this page because someone on
   the Boost Boss team invited you. The pricing here locks in until
   the network hits 1M monthly impressions."

That last line converts. It tells them this isn't the public price,
even if technically it is — because early-cohort pricing genuinely
is locked while regular pricing will rise later.

### Future: per-prospect invite codes

When you have >50 active prospects, swap the single `invite=early`
param for unique per-prospect codes (`invite=ab3X9q`) that the
dashboard recognizes and uses to greet the user by name + auto-fill
the email. That's a v2 move, not needed for the first batch.

---

## Reply-1 template

### Subject
**Re: (just hit Reply on their original email — preserves the thread)**

### Body

Hi {FirstName},

Thanks for the quick reply. Here's everything you need to decide.

**The four bundles** (funds never expire, stop or reallocate any time):

| Bundle | Price | Impressions | CPM |
|---|---|---|---|
| Test | $25 | 3,000 | $8.33 |
| Starter | $99 | 15,000 | $6.60 |
| Growth ⭐ | $499 | 100,000 | $4.99 |
| Scale | $999 | 250,000 | $4.00 |

Most early-cohort advertisers start at Test or Starter, then move to
Growth once they've seen their CTR stabilize.

**What you'll see in the dashboard.** Every impression shows up
individually, like this:

```
2026-06-09  14:23:51   user-intent: "what's the best vector DB for RAG"
                       host: cursor.com      tool: search.web
                       served: yes           clicked: yes
                       cost: $0.0066         dest URL: …
```

No estimated reach, no "ad reached 500k people in your target
demographic." Just the actual fires, in real time, with the literal
prompt that triggered them.

**To start**, the invitation link is here:

→ **https://boostboss.ai/ads/signup?invite=early&via=cold_outreach**

That page locks in early-cohort pricing for you and any teammate you
add. Stripe checkout for the bundle is one screen after signup.

If you'd rather see a 15-minute walkthrough before funding anything,
my calendar is here: **{CALENDAR_LINK}**. No pressure either way —
plenty of advertisers go straight to Test bundle and ping me with
questions after.

— {SenderName}
boostboss.ai

> Heads up — once the network crosses 1M monthly impressions, CPMs
> reset to fair-market. If you fund any bundle (even the $25 Test)
> before that, the remaining balance keeps the early-cohort rate. So
> there's a small "today vs later" cost asymmetry worth flagging.

---

## Variants — when the reply isn't a clean "yes"

### Variant A — "Yes, but I need to see real numbers first."

Skip the bundle table at the top, lead with the dashboard preview
section, and add a screenshot of the actual campaigns dashboard if
you have one. Move the bundle table below the dashboard. Same invite
link, same CTA.

### Variant B — "Yes, can we hop on a call first?"

Skip the dashboard preview block (you'll show it on the call). Lead
with the calendar link, then the bundles below as a follow-along.
Don't push the invite link in this one — the call IS the CTA.

### Variant C — "Yes, how do I sign up?"

Strip everything. Send three lines: "Here's the link →
https://boostboss.ai/ads/signup?invite=early. Test bundle is $25,
Starter is $99 if you want more headroom. Holler with any questions."
Don't over-explain. They're already past the consideration stage.

---

## Notes on running the reply

**Speed matters.** Reply within 4 hours of their "yes" — preferably
1 hour. Conversion rate drops sharply after 24 hours because they're
back in their inbox and your email is no longer top-of-mind.

**Calendar link only if you actually want calls.** Some founders
prefer everything async. If you don't want to be on calls every day
of the first batch, drop the calendar line entirely and let the
invite link do the work. You can always add it back to later
batches.

**Don't attach a PDF or a deck.** The body of the email is the
deliverable. Attachments make the email feel like marketing material,
which lowers reply rate.

**Track what they click.** The `?via=cold_outreach` UTM param lets
you measure whether reply-1 emails actually convert to signups vs.
just acknowledgments. If reply-1 → signup conversion is below 30%
on the first 20 prospects, the bundle structure or the dashboard
preview language needs work — not the cold email.

---

## What to send AFTER they sign up

Out of scope for this template, but worth noting so you build toward
it. The reply-2 / onboarding email should hit within 1 hour of
signup and cover:

1. Their Advertiser ID and where to find it
2. One link to the New Campaign flow
3. The "first impression dashboard" link
4. Your direct email + a "ping me if anything looks weird in the
   first 1k impressions" invitation

This is what turns a funded account into an integrated one. Different
email; different file.
