// CHANGE THIS to your actual Cloudflare Worker URL.
const WORKER_URL = "https://taco-bank.fusepointjoe.workers.dev/";

const loginArea = document.getElementById("loginArea");
const accountName = document.getElementById("accountName");
const discordId = document.getElementById("discordId");
const accountStatus = document.getElementById("accountStatus");

async function loadDiscordUser() {
  try {
    const response = await fetch(`${WORKER_URL}/me`, {
      credentials: "include"
    });

    const data = await response.json();

    if (data.loggedIn) {
      const display = data.user.global_name || data.user.username;

      loginArea.innerHTML = `
        <div class="signed-in">SIGNED IN WITH DISCORD</div>
        <p><strong>${escapeHtml(display)}</strong><br><small>@${escapeHtml(data.user.username)}</small></p>
        <button class="logout-button" id="logoutBtn">Log Out</button>
      `;

      accountName.textContent = display;
      discordId.textContent = data.user.id;
      accountStatus.textContent = "ACTIVE";
      accountStatus.className = "signed-in";

      document.getElementById("logoutBtn").addEventListener("click", logoutDiscord);
    } else {
      showLoggedOut();
    }
  } catch (err) {
    console.error(err);
    loginArea.innerHTML = `<p>Could not contact Taco Bank authentication.</p>
      <a class="discord-button" href="${WORKER_URL}/login">Sign in with Discord</a>`;
  }
}

function showLoggedOut() {
  loginArea.innerHTML = `
    <p>Use your Discord account to access Taco Bank.</p>
    <a class="discord-button" href="${WORKER_URL}/login">Sign in with Discord</a>
  `;
  accountName.textContent = "Not signed in";
  discordId.textContent = "—";
  accountStatus.textContent = "SIGNED OUT";
  accountStatus.className = "";
}

async function logoutDiscord() {
  await fetch(`${WORKER_URL}/logout`, {
    method: "POST",
    credentials: "include"
  });
  location.reload();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDiscordUser();
