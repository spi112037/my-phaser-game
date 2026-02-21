# IIS Reverse Proxy Deployment (Windows)

This setup exposes your Node API (`server/index.js`) publicly while keeping ComfyUI local on the same host.

## 1) Run API with public bind

In `d:\pray\my-phaser-game\server`, create `.env` from `.env.example`:

```env
PORT=8787
HOST=127.0.0.1
CORS_ALLOW_ORIGINS=https://your-frontend.vercel.app
```

Start API:

```powershell
cd D:\pray\my-phaser-game
npm run mock:dev
```

Verify health:

```powershell
node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>r.text()).then(console.log)"
```

## 2) IIS requirements

Install in IIS:
- `URL Rewrite`
- `Application Request Routing (ARR)`

In IIS Manager:
- Server node -> `Application Request Routing Cache` -> `Server Proxy Settings...`
- Check `Enable proxy`

## 3) Site and reverse proxy rule

Create IIS site bound to your domain (e.g. `api.yourdomain.com`) with HTTPS cert.

Add URL Rewrite inbound rule:
- Match URL: `(.*)`
- Action type: `Rewrite`
- Rewrite URL: `http://127.0.0.1:8787/{R:1}`
- Append query string: `true`

Optional websocket support:
- ARR proxy settings -> enable websocket.

## 4) Firewall

Allow inbound:
- `443` (HTTPS)
- `80` (optional HTTP->HTTPS redirect)

Keep `8787` blocked publicly if IIS and Node are same machine (Node listens localhost only).

## 5) Vercel frontend env

In Vercel project settings set:

```env
VITE_API_BASE=https://api.yourdomain.com
```

Redeploy frontend after changing env.

## 6) Quick checks

- `https://api.yourdomain.com/api/health` returns JSON.
- Frontend can create/join room.
- Card editor can call image/attack APIs.
- If image generation fails, inspect API response `stderr/stdout`.
