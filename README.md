# Flowstate Urban Traffic Network Optimization

Flowstate is a browser-based Bengaluru traffic-network simulation. It uses an OpenStreetMap basemap, simulated junction traffic, graph-weighted routes, incident rerouting, and emergency signal-priority recommendations.

## Run locally

1. Install Node.js 18 or later.
2. From this folder, run `npm start`.
3. Open <http://127.0.0.1:3000/> and create an account.

Accounts are stored locally in `data/users.json`, which is excluded from version control. Passwords are salted and hashed with Node.js `scrypt`; the application does not save plaintext passwords. The server issues an HTTP-only, SameSite session cookie. Sessions expire after 12 hours and are cleared when the local server restarts.

This is a local academic prototype: traffic and incident data are simulated, and account/session storage and rate limits are local to one server process. Do not expose it publicly without deploying behind HTTPS and adding production-grade persistent session storage, backups, monitoring, and operational security controls. OpenStreetMap tiles and street-route geometry require an internet connection.
