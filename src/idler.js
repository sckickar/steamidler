import SteamUser from "steam-user";
import {
  STEAM_REFRESH_TOKEN,
  PERSONA,
  DEFAULT_GAMES,
  parseGames,
  FAKE_MATCH
} from "./config.js";
import { log } from "./http-utils.js";
import { createFakeMatch, CS2_APPID } from "./fake-match.js";

export const PERSONA_STATES = {
  online: SteamUser.EPersonaState.Online,
  invisible: SteamUser.EPersonaState.Invisible,
  away: SteamUser.EPersonaState.Away,
};

export const state = {
  steamId: null,
  status: "starting",
  games: DEFAULT_GAMES,
  since: null,
  blockedBy: null,
  lastError: null,
};

const client = new SteamUser({
  autoRelogin: true,
  renewRefreshTokens: false,
});

const fakeMatch = createFakeMatch(client);

let retryTimer = null;

function login() {
  clearTimeout(retryTimer);

  if (!STEAM_REFRESH_TOKEN) {
    state.status = "error";
    state.lastError = "STEAM_REFRESH_TOKEN is not set";

    return log(state.lastError);
  }

  state.status = "logging-in";
  log("logging in... please wait you fucking chode!");

  client.logOn({
    refreshToken: STEAM_REFRESH_TOKEN,
  });
}

function retry(minutes, why) {
  state.status = "waiting";
  state.lastError = why;

  log(`${why}, retrying in ${minutes}`);

  clearTimeout(retryTimer);
  retryTimer = setTimeout(login, minutes * 60_000);
}

function startIdling() {
  const useFakeMatch = FAKE_MATCH && state.games.includes(CS2_APPID);
  const games = useFakeMatch
    ? [CS2_APPID, ...state.games.filter((g) => g !== CS2_APPID)]
    : state.games;
  
  client.gamesPlayed(state.games);
  state.status = "idling";

  state.since = new Date().toISOString();
  state.blockedBy = null;

  log("idling:", state.games.join(", ") || "nothing");

  fakeMatch.stop();
  if(useFakeMatch){
    fakeMatch.start();
  }
}

client.on("loggedOn", () => {
  state.steamId = client.steamID.getSteamID64();
  log("logged in as", state.steamId);
  state.lastError = null;
  client.setPersona(PERSONA_STATES[PERSONA] ?? SteamUser.EPersonaState.Online);
  startIdling();
});

client.on("playingState", (blocked, app) => {
  if (blocked) {
    fakeMatch.stop();
    state.status = "paused";
    state.blockedBy = app;
  } else if (state.status === "paused") {
    log("resuming");
    startIdling();
  }
});

client.on("disconnected", (eresult, msg) => {
  fakeMatch.stop();
  state.status = "reconnecting";
  log("disconnected:", msg || eresult);
});

client.on("error", (e) => {
  const R = SteamUser.EResult;
  if (e.eresult === R.LoggedInElsewhere) {
    return retry(10, "kicked: logged in somewhere else :(");
  }

  if (
    [R.InvalidPassword, R.AccessDenied, R.Expired, R.Revoked].includes(
      e.eresult,
    )
  ) {
    state.status = "error";
    state.lastError = `refresh token rejected (${e.message}) please run "npm run token" again... bitch`;
    return log(state.lastError);
  }
  retry(2, `error: ${e.message}`);
});

export function setGames(input) {
  state.games = parseGames(input);
  log("steam: games set to", state.games.join(", ") || "nothing");
  if (state.status === "idling") {
    startIdling();
  }
  return state;
}

export function restart() {
  log("steam: restart requested");
  try {
    client.logOff();
  } catch {}
  setTimeout(login, 3000);
}

export function start() {
  login();
}

export function stop() {
  try {
    fakeMatch.stop();
    client.logOff();
  } catch {}
}


export const match = fakeMatch.state;