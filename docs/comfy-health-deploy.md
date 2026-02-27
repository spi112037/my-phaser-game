# ComfyUI Health 設計（Vercel + Railway）

## 架構

- Frontend: Vercel (`flamejourneygame.com`)
- Backend API: Railway (`api.flamejourneygame.com`)
- ComfyUI: Windows + IIS/Cloudflare (`comfy.flamejourneygame.com`)

**流向：** Browser → Railway API → ComfyUI

## 必要環境變數

### Vercel (Frontend)

- `VITE_API_BASE=https://api.flamejourneygame.com`

> Vercel preview (`*.vercel.app`) 也要設，避免前端自動推導成不存在的 `api.<preview-host>`。

### Railway (Backend)

- `COMFY_API_BASE=https://comfy.flamejourneygame.com`
- `CORS_ALLOW_ORIGINS=https://flamejourneygame.com,https://your-preview.vercel.app`
- `COMFY_AUTO_START=false`（雲端中介模式建議關閉）

## Health 端點

- `GET /api/health`：API 程式本身狀態
- `GET /api/comfy/health`：Comfy 連線分層狀態

`/api/comfy/health` 回傳重點：
- `checks.dnsOk`
- `checks.httpsOk`
- `checks.apiOk`
- `checks.statusCode`
- `checks.latencyMs`
- `checks.lastError`
- `apiBaseSource`（query/env/fallback）

## 驗證

```bash
curl https://api.flamejourneygame.com/api/health
curl https://api.flamejourneygame.com/api/comfy/health
```

若 `apiBaseSource=fallback_default`，表示 Railway 沒設 `COMFY_API_BASE`。
