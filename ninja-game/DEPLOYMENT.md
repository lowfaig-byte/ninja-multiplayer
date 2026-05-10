# Night of the Ninja — Deployment Guide

Zero-cost deploy: backend on **Render** (free web service), frontend on **Netlify** (free static hosting). GitHub is the source of truth.

---

## 0. Project Structure

```
night-of-ninja/
├── server/           # Node.js + Socket.io backend
│   ├── server.js
│   └── package.json
└── client/           # React frontend
    ├── public/index.html
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   ├── index.css
    │   ├── NightOfNinja.jsx
    │   └── CardDefinitions.js
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── .env.example
```

---

## 1. Push to GitHub

```bash
cd night-of-ninja
git init
git add .
git commit -m "Initial commit — Night of the Ninja"
git branch -M main
git remote add origin https://github.com/<your-user>/night-of-ninja.git
git push -u origin main
```

---

## 2. Deploy the Backend (Render)

1. Go to https://render.com → **New +** → **Web Service**.
2. Connect your GitHub repo.
3. Configure:
   - **Name**: `night-of-ninja-server`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Click **Create Web Service**.
5. Wait for first deploy. Copy the public URL — it'll look like:
   ```
   https://night-of-ninja-server.onrender.com
   ```
6. Hit `https://<your-url>/health` in a browser. You should see `{"ok":true,"rooms":0}`.

> **Free tier note**: Render free instances spin down after ~15 min of inactivity. The first request after sleep takes ~30s to wake. For a party game where players arrive within a minute, this is fine.

---

## 3. Deploy the Frontend (Netlify)

1. Go to https://netlify.com → **Add new site** → **Import from Git**.
2. Pick your repo.
3. Configure:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/build`
4. Under **Site configuration → Environment variables**, add:
   ```
   REACT_APP_SERVER_URL = https://night-of-ninja-server.onrender.com
   ```
   (Your Render URL from step 2.5. No trailing slash.)
5. Click **Deploy site**. Netlify gives you a URL like `dazzling-shinobi.netlify.app`.

---

## 4. Local Development

```bash
# Terminal 1 — server
cd server
npm install
npm run dev          # http://localhost:3001

# Terminal 2 — client
cd client
npm install
cp .env.example .env.local
npm start            # http://localhost:3000
```

Open multiple browser tabs (or your phone on the same Wi-Fi) to test multiplayer. To play across the network locally, set `REACT_APP_SERVER_URL=http://<your-LAN-ip>:3001` in `.env.local`.

---

## 5. Free Alternatives

| Component | Render | Alternative                                  |
| --------- | ------ | -------------------------------------------- |
| Backend   | ✅      | Railway (free trial), Fly.io, Glitch        |
| Frontend  | Netlify | Vercel, GitHub Pages, Cloudflare Pages      |

For Vercel: same flow, set `REACT_APP_SERVER_URL` under Project Settings → Environment Variables → "Production". Vercel auto-detects CRA.

---

## 6. Troubleshooting

**"Connecting…" never resolves on the home screen.**
- Check the browser console for CORS errors. The server already allows `origin: '*'`. If you see a different error, your `REACT_APP_SERVER_URL` is wrong or the Render service is asleep — visit `/health` in another tab to wake it.

**Players can't see each other in the same room.**
- Make sure they typed the exact 4-letter code (uppercase). The server normalizes to uppercase server-side, but the join input also auto-uppercases.

**Cards look unstyled.**
- Tailwind didn't build. Confirm `tailwind.config.js` and `postcss.config.js` are in `client/` (not `client/src/`) and that `index.css` contains the three `@tailwind` directives.

**Render says "Application failed to respond".**
- The server uses `process.env.PORT`. Don't hardcode a port. Render sets `PORT` automatically.

---

## 7. Going Further

- **Persistent rooms**: swap the in-memory `rooms` Map for Redis (free tier on Upstash) if you want games to survive server restarts.
- **Spectators**: gate the `room:join` 8-player cap behind a flag and add a `spectator: true` field to the player object.
- **Custom decks**: edit `buildDeck()` in both `server/server.js` and `client/src/CardDefinitions.js`. Keep them in sync (or extract to a shared package).
- **Sound design**: add `<audio>` triggers on `state:public` phase changes — taiko hits on round start, koto pluck on card select, blade ring on a kill.
