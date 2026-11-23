const env = process.env;

export const PORT = Number(env.PORT) || 8080;

export const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

export const FAKE_MATCH = /^(1|true|yes)$/i.test(env.FAKE_MATCH || "");

export const STEAM_REFRESH_TOKEN = env.STEAM_REFRESH_TOKEN || "";
export const SESSION_SECRET = env.SESSION_SECRET || "";

export const PERSONA = (env.PERSONA || "online").toLowerCase();

export const ALLOWED_STEAM_IDS = (env.ALLOWED_STEAM_IDS || "")
  .split(/[\s,]+/)
  .filter((s) => /^\d{17}$/.test(s));

export function parseGames(input) {
  const list = Array.isArray(input) ? input : String(input || "").split(/[\s,]+/);
  const ids = list.map((x) => String(x).trim()).filter((x) => /^\d+$/.test(x)).map(Number);
  return [...new Set(ids)].slice(0, 32); // Steam allows at most 32 games at once
}

export const DEFAULT_GAMES = parseGames(env.GAMES);

export function checkConfig() {
  const problems = [];
  if (!STEAM_REFRESH_TOKEN) problems.push("STEAM_REFRESH_TOKEN is not set (run `npm run token`)");
  if (SESSION_SECRET.length < 32) problems.push("SESSION_SECRET must be at least 32 characters (run `npm run secret`)");
  if (!env.PUBLIC_URL) problems.push(`PUBLIC_URL is not set, using ${PUBLIC_URL}`);
  return problems;
}