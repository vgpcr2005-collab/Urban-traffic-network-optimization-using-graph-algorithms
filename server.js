const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 15;
const COOKIE_NAME = "flowstate_session";
const DATA_DIRECTORY = path.join(__dirname, "data");
const USER_FILE = path.join(DATA_DIRECTORY, "users.json");
const STATIC_FILES = new Map([
  ["/", ["auth.html", "text/html; charset=utf-8"]],
  ["/auth.html", ["auth.html", "text/html; charset=utf-8"]],
  ["/auth.css", ["auth.css", "text/css; charset=utf-8"]],
  ["/auth.js", ["auth.js", "text/javascript; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
]);

fs.mkdirSync(DATA_DIRECTORY, { recursive: true, mode: 0o700 });

function loadUsers() {
  try {
    const stored = JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
    if (!Array.isArray(stored)) throw new Error("User store must contain a JSON array.");
    const records = new Map();
    for (const user of stored) {
      if (!user || !/^[a-z0-9_.-]{3,24}$/.test(user.username) ||
          !/^[a-f0-9]{32}$/.test(user.salt) || !/^[a-f0-9]{128}$/.test(user.passwordHash) ||
          records.has(user.username)) {
        throw new Error("Account data is malformed or contains duplicate usernames.");
      }
      records.set(user.username, user);
    }
    return records;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw new Error(`Could not load account data from ${USER_FILE}: ${error.message}`);
  }
}

const users = loadUsers();
const sessions = new Map();
const authAttempts = new Map();

function saveUsers() {
  const temporaryFile = path.join(DATA_DIRECTORY, `users-${crypto.randomBytes(12).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify([...users.values()], null, 2), { mode: 0o600 });
    fs.renameSync(temporaryFile, USER_FILE);
  } catch (error) {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    throw error;
  }
}

function derivePasswordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function sendJson(response, status, body, additionalHeaders = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    ...additionalHeaders
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > 8192) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Send a valid JSON request."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function requestCookies(request) {
  const header = request.headers.cookie || "";
  return new Map(header.split(";").map(part => {
    const separator = part.indexOf("=");
    if (separator === -1) return ["", ""];
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_DURATION_MS });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`;
}

function authenticatedUser(request) {
  const token = requestCookies(request).get(COOKIE_NAME);
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return users.get(session.username) || null;
}

function requireSameOrigin(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    if (new URL(origin).host === request.headers.host) return true;
  } catch {
    // Invalid origins are rejected below.
  }
  sendJson(response, 403, { error: "This request was not accepted." });
  return false;
}

function checkAuthRate(request, response) {
  const address = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = authAttempts.get(address);
  if (current && current.expiresAt > now && current.count >= AUTH_ATTEMPT_LIMIT) {
    const seconds = Math.ceil((current.expiresAt - now) / 1000);
    sendJson(response, 429, { error: "Too many attempts. Please wait and try again." }, { "Retry-After": String(seconds) });
    return false;
  }
  if (!current || current.expiresAt <= now) {
    authAttempts.set(address, { count: 1, expiresAt: now + AUTH_WINDOW_MS });
  } else {
    current.count += 1;
  }
  if (authAttempts.size > 5000) {
    for (const [key, attempt] of authAttempts) {
      if (attempt.expiresAt <= now) authAttempts.delete(key);
    }
  }
  return true;
}

function publicUser(user) {
  return { username: user.username };
}

async function handleAuth(request, response, pathname) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST" });
    return;
  }
  if (!requireSameOrigin(request, response) || !checkAuthRate(request, response)) return;
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    sendJson(response, 415, { error: "Send credentials as JSON." });
    return;
  }

  const payload = await readJson(request);
  const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (pathname === "/api/register") {
    if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
      sendJson(response, 400, { error: "Choose a username with 3–24 letters, numbers, dots, underscores, or hyphens." });
      return;
    }
    if (password.length < 10 || password.length > 128) {
      sendJson(response, 400, { error: "Use a password between 10 and 128 characters." });
      return;
    }
    if (users.has(username)) {
      sendJson(response, 409, { error: "That username is already registered. Try logging in instead." });
      return;
    }

    const salt = crypto.randomBytes(16);
    const passwordHash = await derivePasswordHash(password, salt);
    if (users.has(username)) {
      sendJson(response, 409, { error: "That username is already registered. Try logging in instead." });
      return;
    }
    const user = { username, salt: salt.toString("hex"), passwordHash: passwordHash.toString("hex"), createdAt: new Date().toISOString() };
    users.set(username, user);
    try {
      saveUsers();
    } catch (error) {
      users.delete(username);
      throw error;
    }
    authAttempts.delete(request.socket.remoteAddress || "unknown");
    sendJson(response, 201, { user: publicUser(user) }, { "Set-Cookie": createSession(username) });
    return;
  }

  if (pathname === "/api/login") {
    if (password.length === 0 || password.length > 128) {
      sendJson(response, 401, { error: "Incorrect username or password." });
      return;
    }
    const user = users.get(username);
    const salt = user ? Buffer.from(user.salt, "hex") : Buffer.alloc(16);
    const expectedHash = user ? Buffer.from(user.passwordHash, "hex") : Buffer.alloc(64);
    const actualHash = await derivePasswordHash(password, salt);
    const matches = crypto.timingSafeEqual(actualHash, expectedHash);
    if (!user || !matches) {
      sendJson(response, 401, { error: "Incorrect username or password." });
      return;
    }
    authAttempts.delete(request.socket.remoteAddress || "unknown");
    sendJson(response, 200, { user: publicUser(user) }, { "Set-Cookie": createSession(username) });
    return;
  }

  sendJson(response, 404, { error: "Authentication endpoint not found." });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/me") {
      const user = authenticatedUser(request);
      sendJson(response, user ? 200 : 401, user ? { user: publicUser(user) } : { error: "Sign in to continue." });
      return;
    }
    if (url.pathname === "/api/logout") {
      if (request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST" });
        return;
      }
      if (!requireSameOrigin(request, response)) return;
      const token = requestCookies(request).get(COOKIE_NAME);
      if (token) sessions.delete(token);
      sendJson(response, 200, { ok: true }, {
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
      });
      return;
    }
    if (url.pathname === "/api/login" || url.pathname === "/api/register") {
      await handleAuth(request, response, url.pathname);
      return;
    }
    sendJson(response, 404, { error: "API endpoint not found." });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed.");
    return;
  }
  const entry = STATIC_FILES.get(url.pathname);
  if (!entry) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end("Not found.");
    return;
  }
  const [filename, contentType] = entry;
  const contents = fs.readFileSync(path.join(__dirname, filename));
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin"
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch(error => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : "The server could not complete your request." });
    } else {
      response.destroy();
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  server.maxRequestsPerSocket = 100;
  const sessionCleanup = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  }, 15 * 60 * 1000);
  sessionCleanup.unref();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Flowstate is ready at http://0.0.0.0:${PORT}`);
  console.log(`Account records are stored locally in ${USER_FILE}`);
});
