# Lumi Discord · Door 4 validation bot

Throwaway Discord bot demonstrating `@boostbossai/lumi-discord` against
the live `/v1/ad-request` REST endpoint with sandbox credentials.

## Setup

### 1. Create the bot

1. Open [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → name it whatever (e.g. "BB Test Bot")
3. **Bot** tab → **Reset Token** → copy the token
4. **General Information** → copy the **Application ID**
5. **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Copy the generated URL → open it → invite the bot to a test server

### 2. Configure

```bash
cd sdk/lumi-discord/example-bot
cp .env.example .env
# Edit .env:
#   DISCORD_TOKEN=...
#   DISCORD_CLIENT_ID=...
#   DISCORD_GUILD_ID=...   (optional — your test server ID, makes /ask appear instantly)
#   BOOSTBOSS_API_KEY=sk_test_demo   (sandbox)
```

### 3. Install + register the slash command

```bash
npm install
node register-commands.js
```

Guild-scoped commands appear instantly. Global commands take up to 1 hour
to propagate (so set `DISCORD_GUILD_ID` in `.env` for testing).

### 4. Run

```bash
node bot.js
# Console: "✓ Logged in as <name> — ready to receive /ask"
```

In your test server: type `/ask query: how do I deploy?`

## What to verify

- [ ] Bot replies with a fake AI answer + a sponsored embed
- [ ] Embed has: pink left bar (`color: 0xFF2D78`), title (headline),
      description (body), image (if creative has one), `Sponsored` footer,
      timestamp
- [ ] An action button labeled with the CTA (e.g. "Try Free") below the
      embed — clicking it opens the click_url in a browser
- [ ] Bot console logs: `[ask]`, `[ad] served: <headline>`, then the
      impression beacon fires (no error)
- [ ] If you `/ask` 5 times fast, you see different sandbox creatives
      from the rotation pool (or the same one repeated for the same
      session_id — both behaviors are correct depending on caching)

## Screenshot the embed

Important — this is the artifact we're collecting. Take a screenshot
of the bot's reply showing the AI answer + sponsored embed + button.

## Cleanup

After validation: stop the bot (Ctrl+C), delete this directory or remove
the bot from your test server. Keep the test server.
