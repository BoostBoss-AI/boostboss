# Team Directory — names, roles, emails

How to read this:
- **Customer-facing** agents use a **human name** and sign outgoing messages (customers see them).
- **Internal** agents use a **codename** — never seen outside the company.
- **Functional inboxes** (support@, billing@, payouts@) are role addresses; a human-named agent
  staffs them (e.g. Quinn answers support@).
- All names are **proposals — rename anything.** Once you settle them, provision the inboxes below.

## Leadership
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Hermes** | Secretary (Chairman's interface) | hermes@boostboss.ai | internal (Chairman only) |
| **Atlas** | CEO / Orchestrator | atlas@boostboss.ai | internal |

## Engineering (internal)
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Forge** | Coder | dev@boostboss.ai | internal |
| **Argus** | Reviewer / QA | qa@boostboss.ai | internal |
| **Lumen** | SDK Maintainer | sdk@boostboss.ai | internal |
| **Helm** | DevOps | ops@boostboss.ai | internal |

## Benna (customer brain / spine)
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Benna** | Optimization (Benna-Ads) | benna@boostboss.ai | advertiser-facing |
| **Sandy** | Acquisition / Outreach (Benna-Reach) | sandy@boostboss.ai | customer-facing |
| **Robin** | Onboarding Concierge | onboarding@boostboss.ai | customer-facing |
| **Quinn** | Support Triage | support@boostboss.ai | customer-facing |
| **Nova** | Retention / Success | success@boostboss.ai | customer-facing |

## Finance (money rails)
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Vault** | Pay-in / Billing | billing@boostboss.ai | advertiser-facing (receipts) |
| **Tally** | Payouts | payouts@boostboss.ai | publisher-facing (payout notices) |
| **Ledger** | Attribution | (internal) | internal |

## Exchange & Trust (internal back office)
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Aegis** | Compliance | compliance@boostboss.ai | internal |
| **Sentinel** | Fraud / Quality | trust@boostboss.ai | internal |
| **Pulse** | Reporting | reports@boostboss.ai | internal |

## Growth & Content
| Agent | Role | Email | Facing |
|---|---|---|---|
| **Quill** | Editor / Copy | content@boostboss.ai | semi |
| **Iris** | Design | design@boostboss.ai | internal |

## Email provisioning — who actually needs an inbox
Internal agents coordinate through the command channel + shared memory, **not email** — email is
for the outside world. So only external-facing functions need a real, monitored inbox.

### External — MUST provision (customers send to / receive from these)
| Inbox | Agent | Purpose |
|---|---|---|
| sandy@boostboss.ai | Sandy | outreach / acquisition |
| onboarding@boostboss.ai | Robin | onboarding help |
| support@boostboss.ai | Quinn | support questions |
| success@boostboss.ai | Nova | retention / check-ins |
| billing@boostboss.ai | Vault | advertiser receipts & billing |
| payouts@boostboss.ai | Tally | publisher payout notices |
| benna@boostboss.ai | Benna | advertiser optimization updates (optional) |
| compliance@boostboss.ai | Aegis | ads.txt / IAB / abuse inquiries (optional, recommended) |

### Standard role addresses (good hygiene, not tied to one agent)
- `hello@` or `contact@` — general inbound (routes to Quinn)
- `abuse@`, `privacy@` — compliance/legal standard (routes to Aegis)

### Internal — OPTIONAL (only for labeling / logins; not needed to function)
Atlas · Hermes · Forge · Argus · Lumen · Helm · Ledger · Sentinel · Pulse · Quill · Iris
Give them handles (atlas@, hermes@ …) only if you want per-agent logins or labels.

---
**Note on personas:** customer-facing names (Sandy, Robin, Quinn, Nova) are fictional personas,
disclosed as AI where required. Never impersonate a real person. The Benna brand is singular —
"one Benna, many hands" — even though several internal agents power it.
