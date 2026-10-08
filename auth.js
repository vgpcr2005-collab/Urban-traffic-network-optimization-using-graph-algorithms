const authForm = document.querySelector("#auth-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const confirmInput = document.querySelector("#password-confirm");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
let authMode = "login";

async function redirectIfSignedIn() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) window.location.replace("/index.html");
  } catch {
    showMessage("Could not connect to Flowstate. Check that the local server is running.", "error");
  }
}

function showMessage(text, type) {
  message.hidden = false;
  message.className = `form-message ${type}`;
  message.textContent = text;
}

function setMode(nextMode) {
  authMode = nextMode;
  const registering = authMode === "register";
  document.querySelector("#login-tab").classList.toggle("active", !registering);
  document.querySelector("#register-tab").classList.toggle("active", registering);
  document.querySelector("#login-tab").setAttribute("aria-selected", String(!registering));
  document.querySelector("#register-tab").setAttribute("aria-selected", String(registering));
  document.querySelector("#auth-title").textContent = registering ? "Create your account" : "Welcome back";
  document.querySelector("#auth-subtitle").textContent = registering
    ? "Set up your secure account to access the traffic workspace."
    : "Sign in to continue to your traffic workspace.";
  document.querySelector("#submit-label").textContent = registering ? "Create secure account" : "Sign in to workspace";
  document.querySelector("#confirm-field").hidden = !registering;
  document.querySelector("#password-hint").textContent = registering ? "Use at least 10 characters." : "Your password is never stored as plain text.";
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  confirmInput.required = registering;
  message.hidden = true;
  message.textContent = "";
  authForm.reset();
}

document.querySelector("#login-tab").addEventListener("click", () => setMode("login"));
document.querySelector("#register-tab").addEventListener("click", () => setMode("register"));
document.querySelector("#password-toggle").addEventListener("click", event => {
  const visible = passwordInput.type === "password";
  passwordInput.type = visible ? "text" : "password";
  event.currentTarget.textContent = visible ? "Hide" : "Show";
  event.currentTarget.setAttribute("aria-label", visible ? "Hide password" : "Show password");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  message.hidden = true;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    showMessage("Choose a username with 3–24 letters, numbers, dots, underscores, or hyphens.", "error");
    usernameInput.focus();
    return;
  }
  if (password.length < 10 || password.length > 128) {
    showMessage("Use a password between 10 and 128 characters.", "error");
    passwordInput.focus();
    return;
  }
  if (authMode === "register" && password !== confirmInput.value) {
    showMessage("Those passwords do not match. Please try again.", "error");
    confirmInput.focus();
    return;
  }

  submitButton.disabled = true;
  document.querySelector("#submit-label").textContent = authMode === "register" ? "Creating account…" : "Signing you in…";
  try {
    const response = await fetch(`/api/${authMode}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) {
      showMessage(result.error || "We could not complete that request.", "error");
      return;
    }
    showMessage(authMode === "register" ? "Account created. Opening your workspace…" : "Signed in. Opening your workspace…", "success");
    window.location.assign("/index.html");
  } catch {
    showMessage("Could not connect to Flowstate. Check that the local server is running.", "error");
  } finally {
    submitButton.disabled = false;
    document.querySelector("#submit-label").textContent = authMode === "register" ? "Create secure account" : "Sign in to workspace";
  }
});

redirectIfSignedIn();
