// Door 4 validation — minimal Telegram bot demonstrating
// @boostbossai/lumi-telegram. Listens for /ask, fetches an ad from
// /v1/ad-request, replies with a fake AI answer + sponsored card.
//
// Setup:
//   1. Talk to @BotFather → /newbot → copy the token
//   2. cp .env.example .env  → paste TELEGRAM_TOKEN
//   3. npm install
//   4. node bot.js
//
// Then: open the bot in Telegram, /start, then /ask how do I deploy?

import { Telegraf } from "telegraf";
import { toTelegramMessage } from "@boostbossai/lumi-telegram";
import "dotenv/config";

const TOKEN   = process.env.TELEGRAM_TOKEN;
const API_KEY = process.env.BOOSTBOSS_API_KEY || "sk_test_demo";
const API_URL = process.env.BOOSTBOSS_API_URL || "https://boostboss.ai/v1/ad-request";

if (!TOKEN) {
  console.error("Missing TELEGRAM_TOKEN in .env");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

function fakeAnswer(query) {
  const q = (query || "").toLowerCase();
  if (/deploy|host/.test(q)) return "Railway and Fly.io are both solid for Python. Railway has zero-config git push deploys; Fly.io gives you global edge regions.";
  if (/debug|error/.test(q)) return "Start with the stack trace and check the line number. Common issues: indentation, missing imports, version mismatches.";
  if (/database|db/.test(q)) return "Supabase or Neon are easy to start with — Postgres + auth + a dashboard, no infra setup.";
  return `(test answer for: ${query}) — Boost Boss validation bot.`;
}

async function fetchAd(context) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ format: "card", context, platform: "telegram" }),
  });
  if (!r.ok) {
    console.error(`[ad-request] ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  const j = await r.json();
  return j.ad || null;
}

bot.start((ctx) =>
  ctx.reply("Boost Boss validation bot. Try: /ask how do I deploy?")
);

bot.command("ask", async (ctx) => {
  const query = ctx.message.text.replace(/^\/ask(\s+|$)/, "").trim() || "general help";
  console.log(`[ask] ${ctx.from.username || ctx.from.id}: ${query}`);

  // Send the AI answer first as a normal message
  await ctx.reply(fakeAnswer(query));

  // Then fetch + send sponsored card as a second message
  const ad = await fetchAd(query);
  if (ad) {
    const { text, options } = toTelegramMessage(ad);
    await ctx.reply(text, options);
    console.log(`[ad] served: ${ad.headline} (auction ${ad.auction_id})`);
    if (ad.impression_url) {
      fetch(ad.impression_url).catch((e) =>
        console.warn("[impression] beacon failed:", e.message)
      );
    }
  } else {
    console.log("[ad] no fill");
  }
});

bot.launch();
console.log("✓ Bot running — message it on Telegram with /ask <query>");

// Graceful stop on Ctrl+C
process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
