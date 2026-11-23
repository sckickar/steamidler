import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PORT, PUBLIC_URL, SESSION_SECRET, ALLOWED_STEAM_IDS, checkConfig } from "./config.js";
import { createSessionCookie, clearSessionCookie, readSession, steamLoginUrl, verifySteamCallback } from "./auth.js";
import { log, send, sendJson, sendText, redirect, readJson, loadStaticFiles, sendFile } from "./http-utils.js";
import * as idler from "./idler.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const files = loadStaticFiles(PUBLIC_DIR);

const PUBLIC_FILES = new Set(["/login.html", "/denied.html", "/style.css"]);

const SECURE_COOKIE = PUBLIC_URL.startsWith("https://");
const PUBLIC_ORIGIN = new URL(PUBLIC_URL).origin;

function isAllowed(steamId) {
  if (ALLOWED_STEAM_IDS.length) return ALLOWED_STEAM_IDS.includes(steamId);
  return steamId === idler.state.steamId; // default: only the idled account
}

const denied = (res, reason) => redirect(res, `/denied.html?reason=${encodeURIComponent(reason)}`);

async function handle(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  const { pathname } = url;
  const method = req.method;

  // ---- public routes -------------------------------------------------------
  if (pathname === "/health") return sendText(res, 200, "ok\n"); // for UptimeRobot / Koyeb

  if (pathname === "/auth/login" && method === "GET") {
    return redirect(res, steamLoginUrl(PUBLIC_URL));
  }

  if (pathname === "/auth/callback" && method === "GET") {
    const steamId = await verifySteamCallback(url.searchParams, PUBLIC_URL);
    if (!steamId) return denied(res, "Steam sign-in could not be verified.");
    if (!isAllowed(steamId)) {
      log("auth: denied sign-in from", steamId);
      return denied(res, `Steam account ${steamId} is not allowed to use this idler.`);
    }
    log("auth: signed in", steamId);
    return redirect(res, "/", { "set-cookie": createSessionCookie(steamId, SESSION_SECRET, SECURE_COOKIE) });
  }

  if (pathname === "/auth/logout" && method === "POST") {
    return redirect(res, "/", { "set-cookie": clearSessionCookie(SECURE_COOKIE) });
  }

  if (PUBLIC_FILES.has(pathname) && method === "GET") {
    return sendFile(res, files.get(pathname));
  }

  // ---- everything below needs a valid session -----------------------------
  const user = readSession(req.headers.cookie, SESSION_SECRET);

  if (!pathname.startsWith("/api/")) {
    if (method !== "GET") return sendText(res, 405, "method not allowed\n");
    if (pathname === "/" || pathname === "/index.html") {
      return sendFile(res, files.get(user ? "/index.html" : "/login.html"));
    }
    if (!user) return redirect(res, "/");
    const file = files.get(pathname);
    return file ? sendFile(res, file) : sendText(res, 404, "not found\n");
  }

  if (!user) return sendJson(res, 401, { error: "not signed in" });

  // Block other websites from sending requests on your behalf (CSRF).
  if (method !== "GET" && req.headers.origin !== PUBLIC_ORIGIN) {
    return sendJson(res, 403, { error: "bad origin" });
  }

  if (pathname === "/api/me" && method === "GET") {
    return sendJson(res, 200, { steamId: user });
  }

  if (pathname === "/api/status" && method === "GET") {
    return sendJson(res, 200, { ...idler.state, match: idler.match });
  }

  if (pathname === "/api/games" && method === "POST") {
    const body = await readJson(req);
    return sendJson(res, 200, idler.setGames(body.games ?? ""));
  }

  if (pathname === "/api/restart" && method === "POST") {
    idler.restart();
    return sendJson(res, 202, { ok: true });
  }

  return sendJson(res, 404, { error: "not found" });
}

for (const problem of checkConfig()) log("config:", problem);
if (SESSION_SECRET.length < 32) {
  log("config: refusing to start without a proper SESSION_SECRET");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    log("server error:", err);
    if (!res.headersSent) send(res, 500, "internal error\n", { "content-type": "text/plain" });
  });
});

server.listen(PORT, () => log(`web: listening on :${PORT} (public URL ${PUBLIC_URL})`));
idler.start();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log(`${signal}: shutting down`);
    idler.stop();
    server.close();
    setTimeout(() => process.exit(0), 1000);
  });
}