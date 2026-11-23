const $ = (id) => document.getElementById(id);

async function api(path, body) {
  const options = body === undefined ? {} : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
  const res = await fetch(path, options);
  if (res.status === 401) location.reload();
  return res;
}

function gameLink(id) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = "https://store.steampowered.com/app/" + id;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = id;
  li.append(a);
  return li;
}

async function refresh() {
  try {
    const s = await (await api("/api/status")).json();
    $("status").textContent = s.status;
    $("since").textContent = s.since ? new Date(s.since).toLocaleString() : "-";
    $("blocked").textContent = s.blockedBy ? "you, playing app " + s.blockedBy : "-";
    $("error").textContent = s.lastError || "-";
    const m = s.match || {};
    $("match").textContent = m.phase === "live" ? `Dust II [ ${m.us} : ${m.them} ] round ${m.round}`
      : m.phase === "break" ? `match over [ ${m.us} : ${m.them} ], next one soon` : "-";
    $("games").replaceChildren(...s.games.map(gameLink));
    if (document.activeElement !== $("ids")) $("ids").value = s.games.join(", ");
  } catch {
    $("status").textContent = "unreachable";
  }
}

async function post(path, body) {
  const res = await api(path, body || {});
  $("msg").textContent = res.ok ? "done" : ((await res.json()).error || "failed");
  setTimeout(refresh, 1500);
}

$("settings").addEventListener("submit", (e) => {
  e.preventDefault();
  post("/api/games", { games: $("ids").value });
});
$("restart").addEventListener("click", () => post("/api/restart"));

api("/api/me").then((r) => r.json()).then((me) => {
  $("me").textContent = "Signed in as " + me.steamId + " ";
});

refresh();
setInterval(refresh, 10000);