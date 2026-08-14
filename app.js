// Demo-only frontend until your private backend is connected.
// Replace with your Cloudflare Worker / Render URL later.
const BANK_API_URL = "";

const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const accountName = document.getElementById("accountName");
const balanceDisplay = document.getElementById("balance");
const withdrawAmount = document.getElementById("withdrawAmount");
const withdrawBtn = document.getElementById("withdrawBtn");
const withdrawMessage = document.getElementById("withdrawMessage");

let currentUser = "";

loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  if (!username) return loginMessage.textContent = "Please enter your Minecraft username.";

  currentUser = username;
  accountName.textContent = username;

  if (!BANK_API_URL) {
    balanceDisplay.textContent = "£500.00";
    loginMessage.textContent = "Demo mode: backend not connected.";
    return;
  }

  try {
    loginMessage.textContent = "Loading account...";
    const r = await fetch(`${BANK_API_URL}/api/account?username=${encodeURIComponent(username)}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    balanceDisplay.textContent = `£${Number(data.balance).toFixed(2)}`;
    loginMessage.textContent = "Account loaded.";
  } catch {
    loginMessage.textContent = "Could not load account.";
  }
});

withdrawBtn.addEventListener("click", async () => {
  const amount = Number(withdrawAmount.value);
  if (!currentUser) return withdrawMessage.textContent = "Sign in first.";
  if (!Number.isFinite(amount) || amount <= 0) return withdrawMessage.textContent = "Enter a valid amount.";

  if (!BANK_API_URL) {
    withdrawMessage.textContent = `Demo only: £${amount.toFixed(2)} was NOT actually withdrawn.`;
    return;
  }

  try {
    withdrawBtn.disabled = true;
    withdrawMessage.textContent = "Submitting withdrawal...";
    const r = await fetch(`${BANK_API_URL}/api/withdraw`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({username: currentUser, amount})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Withdrawal failed.");
    balanceDisplay.textContent = `£${Number(data.balance).toFixed(2)}`;
    withdrawMessage.textContent = "Withdrawal submitted.";
    withdrawAmount.value = "";
  } catch (e) {
    withdrawMessage.textContent = e.message;
  } finally {
    withdrawBtn.disabled = false;
  }
});
