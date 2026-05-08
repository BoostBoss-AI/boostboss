// Door 4 validation — minimal Slack bot demonstrating
// @boostbossai/lumi-slack. Listens for /ask slash command, fetches an
// ad from /v1/ad-request, replies with a fake AI answer + sponsored
// Block Kit message in-channel.
//
// Uses Socket Mode so you don't need a public URL. Setup steps in README.

import bolt from "@slack/bolt";
import { toSlackBlocks } from "@boostbossai/lumi-slack";
import "dotenv/config";

const { App } = bolt;

const BOT_TOKEN      = process.env.SLACK_BOT_TOKEN;
const APP_TOKEN      = process.env.SLACK_APP_TOKEN;
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const API_KEY        = process.env.BOOSTBOSS_API_KEY || "sk_test_demo";
const API_URL        = process.env.BOOSTBOSS_API_URL || "https://boostboss.ai/v1/ad-request";

if (!BOT_TOKEN || !APP_TOKEN || !SIGNING_SECRET) {
  console.error("Missing one of SLACK_BOT_TOKEN / SLACK_APP_TOKEN / SLACK_SIGNING_SECRET in .env");
  process.exit(1);
}

const app = new App({
  token:          BOT_TOKEN,
  signingSecret:  SIGNING_SECRET,
  socketMode:     true,
  appToken:       APP_TOKEN,
});

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
    body: JSON.stringify({ format: "card", context, platform: "slack" }),
  });
  if (!r.ok) {
    console.error(`[ad-request] ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  const j = await r.json();
  return j.ad || null;
}

app.command("/ask", async ({ command, ack, respond }) => {
  await ack();
  const query = (command.text || "general help").trim();
  console.log(`[ask] ${command.user_name}: ${query}`);

  const answer = fakeAnswer(query);
  const ad     = await fetchAd(query);

  // First message: AI answer (visible to whole channel — response_type "in_channel")
  await respond({ response_type: "in_channel", text: answer });

  // Second message: sponsored block (also in_channel)
  if (ad) {
    await respond({
      response_type: "in_channel",
      blocks: toSlackBlocks(ad),
      text:   ad.headline, // accessibility fallback
    });
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

(async () => {
  await app.start();
  console.log("✓ Slack bot running (Socket Mode) — type /ask in your test workspace");
})();
