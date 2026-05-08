# Lumi Telegram · Door 4 validation bot

## Setup

### 1. Create the bot

1. Open Telegram → message **@BotFather**
2. `/newbot` → pick a name + username (must end in `bot`, e.g. `bb_test_door4_bot`)
3. Copy the token BotFather sends back

### 2. Configure

```bash
cd sdk/lumi-telegram/example-bot
cp .env.example .env
# Edit .env:
#   TELEGRAM_TOKEN=...
#   BOOSTBOSS_API_KEY=sk_test_demo
```

### 3. Run

```bash
npm install
node bot.js
# Console: "✓ Bot running — message it on Telegram with /ask <query>"
```

In Telegram, find your bot by username, click Start, then:

```
/ask how do I deploy?
```

## What to verify

- [ ] Bot replies with TWO messages: first the AI answer, then the
      sponsored card
- [ ] Sponsored card is HTML-formatted: italic `Sponsored` line, **bold
      headline**, body text underneath
- [ ] An inline-keyboard button below the text shows the CTA label
      (e.g. "Try Free")
- [ ] Tapping the CTA opens the `click_url` in Telegram's in-app browser
- [ ] No "preview" thumbnail attached (we set `disable_web_page_preview: true`)
- [ ] Bot console logs `[ad] served: ...` and the impression beacon
      doesn't error

## Screenshot the card

Take a screenshot showing the AI answer + the sponsored card with the
CTA button. This is the artifact for Door 4 / Telegram.

## Cleanup

Stop bot with Ctrl+C. To delete the bot from Telegram: message
@BotFather → `/deletebot` → select it.
