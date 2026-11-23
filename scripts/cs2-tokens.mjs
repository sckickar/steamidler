import SteamUser from "steam-user";

const friend = process.argv[2];
const token = process.env.STEAM_REFRESH_TOKEN;
if (!token) {
  console.error("STEAM_REFRESH_TOKEN is not set. Run with: node --env-file=.env scripts/cs2-tokens.mjs");
  process.exit(1);
}

const client = new SteamUser();
client.on("error", (e) => { console.error("Steam error:", e.message); process.exit(1); });

client.on("loggedOn", () => {
  client.getAppRichPresenceLocalization(730, "english", (err, res) => {
    if (err) {
      console.error("Could not get CS2 tokens:", err.message);
    } else {
      console.log("\nCS2 display strings (key = text):\n");
      for (const [key, value] of Object.entries(res.tokens)) {
        if (/^#display_/i.test(key)) console.log(`${key} = ${value}`);
      }
      const maps = Object.keys(res.tokens).filter((k) => /dust/i.test(k));
      if (maps.length) console.log("\nDust-related tokens:", maps.join(", "));
    }

    if (!friend) return done();
    client.requestRichPresence(730, [friend], (err2, res2) => {
      if (err2) console.error("Could not read friend's rich presence:", err2.message);
      else {
        const data = res2.users[friend];
        console.log(`\nWhat ${friend} is sending right now:\n`);
        console.log(data ? JSON.stringify(data, null, 2) : "(nothing, are they in CS2 with a public profile?)");
      }
      done();
    });
  });
});

function done() {
  client.logOff();
  setTimeout(() => process.exit(0), 500);
}

client.logOn({ refreshToken: token });