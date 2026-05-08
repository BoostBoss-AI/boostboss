// Door 3 validation — wires @boostbossai/lumi-sdk into a Chrome MV3
// extension side panel. Imports the vendored SDK build (no bundler in
// this throwaway), creates a Lumi instance with the sandbox publisher
// ID, and renders into #ad-slot. Surfaces every Lumi event in the
// in-panel devlog so the validator can see beacons firing without
// opening DevTools.

import { Lumi } from "./vendor/lumi-sdk.js";

const log = (() => {
  const el = document.getElementById("devlog");
  return (ev, payload, level) => {
    const t = new Date().toTimeString().slice(0, 8);
    const row = document.createElement("div");
    row.className = "row " + (level || "");
    row.innerHTML = '<span class="t">' + t + '</span><span class="ev">' + ev + '</span> ' +
                    (payload ? JSON.stringify(payload).slice(0, 160) : "");
    el.prepend(row);
  };
})();

log("init", { version: Lumi.version });

const lumi = new Lumi({
  publisherId: "pub_test_demo",
  debug: true,
});

lumi.on("ready",      (p) => log("ready", p));
lumi.on("impression", (p) => log("impression", { adId: p.adId, surface: p.surface }));
lumi.on("click",      (p) => log("click", { adId: p.adId }));
lumi.on("no_fill",    (p) => log("no_fill", p));
lumi.on("error",      (p) => log("error " + p.code, { msg: p.message }, "error"));

(async () => {
  try {
    const ad = await lumi.render("#ad-slot", {
      format:  "sidebar",
      context: "AI summarizer for the article currently in view",
    });
    if (ad) {
      log("rendered", { campaign: ad.campaignId || ad.campaign_id, headline: (ad.headline || "").slice(0, 40) });
    } else {
      log("no-fill (after render)", {});
    }
  } catch (e) {
    log("render-threw", { msg: String(e) }, "error");
  }
})();
