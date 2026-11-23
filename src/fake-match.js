import { log } from "./http-utils.js";

export const CS2_APPID = 730;

const LABEL = process.env.FAKE_MATCH_LABEL || "Larping";

export const RP = {
    inMatch: (score) => ({
        steam_display: "#display_GameKnownMapScore",
        "game:state": "game",
        "game:mode": "competitive",
        "game:map": "de_dust2",
        "game:score": `${LABEL} ${score}`,
    }),
    inMenu: () => ({
        steam_display: "#display_Menu",
        "game:state": "lobby"
    })
};

const ROUNDS_TO_WIN = 13;
const HALF = 12;
const ROUND_MIN_MS = 90_000;
const ROUND_MAX_MS = 150_000;
const BREAK_MS = 3 * 60_000;

const between = (min, max) => min + Math.random() * (max - min);
const formatScore = (us, them) => `[ ${us} : ${them} ]`;

export function createFakeMatch(client, { winChance = 0.55, timers = { setTimeout, clearTimeout } } = {}) {
  let timer = null;
  let running = false;
  const match = { us: 0, them: 0, round: 0, phase: "idle" }; // idle | live | break

  function upload(data) {
    try {
      client.uploadRichPresence(CS2_APPID, data);
    } catch (e) {
      log("fake-match: rich presence upload failed:", e.message);
    }
  }

  function schedule(fn, ms) {
    timers.clearTimeout(timer);
    timer = timers.setTimeout(fn, ms);
  }

  function newMatch() {
    Object.assign(match, { us: 0, them: 0, round: 0, phase: "live" });
    upload(RP.inMatch(formatScore(0, 0)));
    log("fake-match: new match on Dust II");
    schedule(playRound, between(ROUND_MIN_MS, ROUND_MAX_MS));
  }

  function playRound() {
    match.round++;
    if (Math.random() < winChance) match.us++;
    else match.them++;

    const score = formatScore(match.us, match.them);
    const won = match.us === ROUNDS_TO_WIN;
    const lost = match.them === ROUNDS_TO_WIN;
    const draw = match.us === HALF && match.them === HALF;

    upload(RP.inMatch(score));
    log(`fake-match: round ${match.round} ${score}${match.round === HALF ? " (halftime)" : ""}`);

    if (won || lost || draw) {
      log(`fake-match: match over, ${won ? "won" : lost ? "lost" : "draw"} ${score}`);
      match.phase = "break";
      schedule(() => {
        upload(RP.inMenu());
        schedule(newMatch, BREAK_MS);
      }, 60_000);
      return;
    }

    const extra = match.round === HALF ? 30_000 : 0;
    schedule(playRound, between(ROUND_MIN_MS, ROUND_MAX_MS) + extra);
  }

  return {
    state: match,
    start() {
      if (running) return;
      running = true;
      schedule(newMatch, 3000);
    },
    stop() {
      running = false;
      timers.clearTimeout(timer);
      match.phase = "idle";
    },
    get running() {
      return running;
    },
  };
}