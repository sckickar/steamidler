import fs from "node:fs";
import path from "node:path";

export const log = (...a) => console.log(new Date().toISOString(), ...a);

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

export const sendJson = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });

export const sendText = (res, status, text) =>
  send(res, status, text, { "content-type": "text/plain; charset=utf-8" });

export const redirect = (res, location, headers = {}) =>
  send(res, 302, "", { location, ...headers });


export function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        return resolve({});
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function loadStaticFiles(dir) {
  const files = new Map();
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    files.set(`/${name}`, {
      body: fs.readFileSync(full),
      type: TYPES[path.extname(name)] || "application/octet-stream",
    });
  }
  return files;
}

export function sendFile(res, file) {
  send(res, 200, file.body, { "content-type": file.type });
}