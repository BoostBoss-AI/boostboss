// One-time slash command registration for the test bot. Run once with
// `node register-commands.js` after setting DISCORD_TOKEN and
// DISCORD_CLIENT_ID in .env. Global registration takes ~1 hour to
// propagate; for testing use guild-scoped instead (set DISCORD_GUILD_ID
// in .env to the test server ID).

import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID  = process.env.DISCORD_GUILD_ID; // optional

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask the test AI a question (Door 4 / Discord validation)")
    .addStringOption((o) =>
      o.setName("query").setDescription("Your question").setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      console.log(`Registering ${commands.length} command(s) to guild ${GUILD_ID}…`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log("✓ Guild commands registered (instant)");
    } else {
      console.log(`Registering ${commands.length} command(s) globally…`);
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("✓ Global commands registered (may take up to 1 hour to propagate)");
    }
  } catch (err) {
    console.error("Registration failed:", err);
    process.exit(1);
  }
})();
