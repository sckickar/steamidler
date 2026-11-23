// "Sign in through Steam" (OpenID 2.0) and a signed session cookie.
import crypto from "node:crypto";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const COOKIE = "idler_session";
const MAX_AGE = 7 * 24 * 3600; // 7 days

// ---- session cookie: "<steamid>.<expires>.<hmac>" ---------------------------
const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");

export function createSessionCookie(steamId, secret, secure) {
  const payload = `${steamId}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  const value = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

// Returns the SteamID64 from a valid, unexpired cookie, otherwise null.
export function readSession(cookieHeader, secret) {
  const match = String(cookieHeader || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return null;

  const [steamId, expires, sig] = match[1].split(".");
  if (!/^\d{17}$/.test(steamId) || !/^\d+$/.test(expires) || !sig) return null;
  if (Number(expires) < Date.now() / 1000) return null;

  const expected = Buffer.from(sign(`${steamId}.${expires}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return steamId;
}

// ---- Steam OpenID ------------------------------------------------------------
export function steamLoginUrl(publicUrl) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${publicUrl}/auth/callback`,
    "openid.realm": publicUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID}?${params}`;
}

// Checks the data Steam sent back, then asks Steam to confirm it.
// Returns the SteamID64 on success, otherwise null.
export async function verifySteamCallback(query, publicUrl, fetchImpl = fetch) {
  const q = query; // URLSearchParams
  if (q.get("openid.mode") !== "id_res") return null;
  if (q.get("openid.op_endpoint") !== STEAM_OPENID) return null;
  if (q.get("openid.return_to") !== `${publicUrl}/auth/callback`) return null;
  if (q.get("openid.identity") !== q.get("openid.claimed_id")) return null;

  const signed = (q.get("openid.signed") || "").split(",");
  for (const field of ["claimed_id", "identity", "return_to", "response_nonce"]) {
    if (!signed.includes(field)) return null;
  }

  const id = (q.get("openid.claimed_id") || "").match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!id) return null;

  const body = new URLSearchParams(q);
  body.set("openid.mode", "check_authentication");
  try {
    const res = await fetchImpl(STEAM_OPENID, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    return /^is_valid\s*:\s*true\s*$/m.test(text) ? id[1] : null;
  } catch {
    return null;
  }
}