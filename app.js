// IMPORTANT: replace with your real Cloudflare Worker URL, no trailing slash.
const WORKER_URL = "https://taco-bank.fusepointjoe.workers.dev";
const TOKEN_KEY = "taco_bank_session";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// Discord callback returns to the frontend with #auth=SIGNED_TOKEN.
// Fragments are not sent to GitHub Pages.
(function captureLoginToken() {
  const hash = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);
  const token = hash.get("auth");
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    history.replaceState(null, "", location.pathname + location.search);
  }
})();

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function getMe() {
  const token = getToken();
  if (!token) return {loggedIn:false};

  const response = await fetch(`${WORKER_URL}/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    return {loggedIn:false};
  }
  if (!response.ok) throw new Error("Authentication service unavailable.");
  return await response.json();
}

async function renderAuth() {
  const loginArea = document.getElementById("loginArea");
  const signinStatus = document.getElementById("signinStatus");
  const loginButton = document.getElementById("discordLoginButton");
  const accountName = document.getElementById("accountName");
  const discordId = document.getElementById("discordId");
  const accountStatus = document.getElementById("accountStatus");

  if (loginButton) loginButton.href = `${WORKER_URL}/login`;

  try {
    const data = await getMe();

    if (data.loggedIn) {
      const display = data.user.global_name || data.user.username;

      if (loginArea) {
        loginArea.innerHTML = `<div class="signed-in">SIGNED IN WITH DISCORD</div>
          <p><strong>${escapeHtml(display)}</strong><br><small>@${escapeHtml(data.user.username)}</small></p>
          <button class="logout-button" id="logoutBtn">Log Out</button>`;
        document.getElementById("logoutBtn").onclick = logout;
      }

      if (signinStatus) {
        signinStatus.innerHTML = `<div class="signed-in">You are signed in.</div>
          <p><strong>${escapeHtml(display)}</strong><br><small>@${escapeHtml(data.user.username)}</small></p>
          <a class="discord-button" href="index.html#account">Go to My Account</a>
          <br><br><button class="logout-button" id="logoutBtn2">Log Out</button>`;
        document.getElementById("logoutBtn2").onclick = logout;
      }

      if (accountName) accountName.textContent = display;
      if (discordId) discordId.textContent = data.user.id;
      if (accountStatus) {
        accountStatus.textContent = "ACTIVE";
        accountStatus.className = "signed-in";
      }
      return;
    }

    if (loginArea) {
      loginArea.innerHTML = `<p>Use Discord to access your account.</p>
        <a class="discord-button" href="signin.html">Sign in with Discord</a>`;
    }
    if (signinStatus) {
      signinStatus.innerHTML = `<a class="discord-button" href="${WORKER_URL}/login">Sign in with Discord</a>`;
    }
  } catch (e) {
    console.error(e);
    if (loginArea) loginArea.innerHTML = `<p>Authentication service could not be reached.</p><a class="discord-button" href="signin.html">Sign In</a>`;
    if (signinStatus) signinStatus.innerHTML = `<p>Authentication service could not be reached.</p>`;
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  location.href = "signin.html";
}

renderAuth();
