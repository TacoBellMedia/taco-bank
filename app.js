const API = "https://young-lab-523e.fusepointjoe.workers.dev";

let currentData = null;

const money = n => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2
}).format(Number(n || 0));

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function confClass(v) {
  v = String(v || "").toLowerCase();
  if (v === "high") return "conf-high";
  if (v === "medium") return "conf-medium";
  return "conf-low";
}

async function load() {
  const error = document.getElementById("errorBox");
  error.hidden = true;
  document.getElementById("holdersBody").innerHTML = '<tr><td colspan="7">Loading StateCraft data...</td></tr>';
  document.getElementById("activityBody").innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  try {
    const res = await fetch(`${API}/api/notes`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Backend request failed.");

    currentData = data;
    document.getElementById("trackedValue").textContent = money(data.summary.trackedValue);
    document.getElementById("playerCount").textContent = data.summary.players;
    document.getElementById("tradeCount").textContent = data.summary.matchingTransactions;
    document.getElementById("confidence").textContent = String(data.summary.confidence || "LOW").toUpperCase();
    document.getElementById("updated").textContent = `Last update: ${new Date(data.generatedAt).toLocaleString()}`;
    renderHolders(data.holders);
    renderActivity(data.activity);
  } catch (e) {
    error.hidden = false;
    error.textContent =
      "Taco Watch could not load the Treasury data.\n\n" +
      e.message +
      "\n\nCheck the Worker variables listed in README.md.";
    document.getElementById("holdersBody").innerHTML = '<tr><td colspan="7">No data available.</td></tr>';
    document.getElementById("activityBody").innerHTML = '<tr><td colspan="5">No data available.</td></tr>';
  }
}

function renderHolders(holders) {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const rows = (holders || []).filter(x => String(x.player).toLowerCase().includes(q));
  document.getElementById("holdersBody").innerHTML = rows.length ? rows.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${esc(x.player)}</strong></td>
      <td class="${x.estimated >= 0 ? "positive" : "negative"}">${money(x.estimated)}</td>
      <td>${money(x.acquired)}</td>
      <td>${money(x.disposed)}</td>
      <td>${x.transactions}</td>
      <td class="${confClass(x.confidence)}">${esc(String(x.confidence).toUpperCase())}</td>
    </tr>`).join("") : '<tr><td colspan="7">No matching players.</td></tr>';
}

function renderActivity(activity) {
  document.getElementById("activityBody").innerHTML = (activity || []).length ? activity.map(x => `
    <tr>
      <td>${esc(x.id)}</td>
      <td><strong>${esc(x.player)}</strong></td>
      <td>${esc(x.direction)}</td>
      <td>${money(x.noteValue)}</td>
      <td>${esc(x.memo)}</td>
    </tr>`).join("") : '<tr><td colspan="5">No matching note transactions found.</td></tr>';
}

document.getElementById("refresh").addEventListener("click", load);
document.getElementById("search").addEventListener("input", () => {
  if (currentData) renderHolders(currentData.holders);
});

load();
