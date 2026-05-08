# Lumi Slack · Door 4 validation bot

Uses **Socket Mode** so you don't need a public URL. The bot connects
out to Slack via WebSocket; Slack sends events back over that socket.

## Setup

### 1. Create the Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it "BB Test Bot" (or whatever) → pick a test workspace
3. **Socket Mode** → toggle ON → generate an **App-Level Token** with the
   `connections:write` scope → save the `xapp-...` token
4. **OAuth & Permissions** → **Bot Token Scopes** → add:
   - `commands` (for the slash command)
   - `chat:write` (to post messages)
5. **Slash Commands** → **Create New Command**:
   - Command: `/ask`
   - Short description: "Ask the test AI a question"
   - Usage hint: `<query>`
   - (Request URL not required in Socket Mode — leave blank)
6. **Install App** → **Install to Workspace** → authorize
7. Copy:
   - `xoxb-...` (Bot User OAuth Token from OAuth & Permissions)
   - `xapp-...` (App-Level Token from Basic Information → App-Level Tokens)
   - Signing Secret (Basic Information → App Credentials)

### 2. Configure

```bash
cd sdk/lumi-slack/example-bot
cp .env.example .env
# Edit .env with the three tokens + signing secret
```

### 3. Run

```bash
npm install
node bot.js
# Console: "✓ Slack bot running (Socket Mode) — type /ask in your test workspace"
```

In your Slack workspace, in any channel where the bot is invited:

```
/ask how do I deploy?
```

## What to verify

- [ ] Slash command auto-completes (Slack found the registration)
- [ ] Bot replies with TWO messages in the channel: the AI answer first,
      then the sponsored Block Kit message
- [ ] Sponsored block has: italic disclosure, **bold headline**, body
      text, and a primary-style button (`Try Free` etc.) below
- [ ] If creative has an image, it appears as a thumbnail accessory on
      the right of the section
- [ ] Clicking the CTA button opens the click_url in browser
- [ ] Bot console logs `[ad] served: ...` and the impression beacon
      fires without error

## Screenshot the message

Take a screenshot of the channel showing the AI answer + sponsored
Block Kit message + CTA button. This is the artifact for Door 4 / Slack.

## Cleanup

Stop bot with Ctrl+C. To remove the app from the workspace:
api.slack.com/apps → your app → Manage Distribution / Settings → Delete
App.
