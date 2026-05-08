// Door 4 validation — minimal Discord bot demonstrating
// @boostbossai/lumi-discord. Listens for /ask, fetches an ad from
// /v1/ad-request, replies with a fake AI answer + sponsored embed.
//
// Setup:
//   1. cp .env.example .env  (fill in DISCORD_TOKEN, DISCORD_CLIENT_ID)
//   2. npm install
//   3. node register-commands.js  (one-time)
//   4. node bot.js
//
// Then in your test Discord server: /ask query: how do I deploy?

import { Client, GatewayIntentBits } from "discord.js";
import { toDiscordEmbed, toDiscordComponents } from "@boostbossai/lumi-discord";
import "dotenv/config";

const TOKEN   = process.env.DISCORD_TOKEN;
const API_KEY = process.env.BOOSTBOSS_API_KEY || "sk_test_demo";
const API_URL = process.env.BOOSTBOSS_API_URL || "https://boostboss.ai/v1/ad-request";

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", (c) => {
  console.log(`✓ Logged in as ${c.user.tag} — ready to receive /ask`);
});

// Fake AI answer for the validation. Real bots would call OpenAI/Claude.
function fakeAnswer(query) {
  const q = query.toLowerCase();
  if (/deploy|host/.test(q)) return "Railway and Fly.io are both solid for Python apps. Railway has zero-config git push deploys; Fly.io gives you global edge regions out of the box.";
  if (/debug|error/.test(q)) return "Start with the stack trace and check the line number. Common Python issues: indentation, missing imports, version mismatches in requirements.txt.";
  if (/database|db/.test(q)) return "For a new project, Supabase or Neon are easy to start with. Both give you Postgres + auth + a dashboard, no infra setup.";
  return `(test answer for: ${query}) — Boost Boss validation bot. The sponsored block below is real demand from the BBX exchange.`;
}

async function fetchAd(context) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ format: "embed", context, platform: "discord" }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    console.error(`[ad-request] ${r.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const j = await r.json();
  return j.ad || null;
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "ask") return;

  const query = interaction.options.getString("query");
  console.log(`[ask] ${interaction.user.tag}: ${query}`);

  await interaction.deferReply();

  // Fetch ad (parallel to "thinking")
  const adPromise = fetchAd(query);
  const answer   = fakeAnswer(query);
  const ad       = await adPromise;

  const reply = { content: answer };
  if (ad) {
    reply.embeds     = [toDiscordEmbed(ad)];
    reply.components = [toDiscordComponents(ad)];
    console.log(`[ad] served: ${ad.headline} (auction ${ad.auction_id})`);
    // Fire impression beacon — fire-and-forget
    if (ad.impression_url) {
      fetch(ad.impression_url).catch((e) =>
        console.warn("[impression] beacon failed:", e.message)
      );
    }
  } else {
    console.log("[ad] no fill");
  }

  await interaction.editReply(reply);
});

client.login(TOKEN);
