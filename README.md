# NOVA V13 — Global Intelligence + Cloud Sync

Mobile-first NOVA personal AI assistant project, based on the existing V12 cloud-sync build with a Global Intelligence research workspace.

## Included in this package
- Gemini primary + Groq automatic fallback for AI chat and reports
- Browser voice input/output where supported; START / RUKO controls
- PostgreSQL cloud accounts and per-account JSON sync for supported app data
- Tasks, money records, business notes, research notes, memory notes, social drafts and chat history
- PWA install support, 3D hologram, local photo/video tools and local IndexedDB file vault
- Global Intelligence workspace for market research, international trade, competitor intelligence, customer research, business ideas and opportunity analysis
- Optional Tavily search integration; source links are shown when live search is configured
- Backend health and provider status endpoints

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set provider keys if available.
4. Run `npm start` and open `http://localhost:10000`.

## Deploy on Render
1. Upload the contents of this ZIP to the root of the GitHub repository; keep the `public/` folder.
2. Use a Render **Web Service**, Node runtime, Build Command `npm install`, Start Command `npm start`.
3. Add environment variables in Render (never in GitHub):
   - `GEMINI_API_KEY` (optional AI provider)
   - `GROQ_API_KEY` (optional backup AI provider)
   - `TAVILY_API_KEY` (optional live web search for Global Intelligence)
   - `DATABASE_URL` (optional PostgreSQL internal URL for cloud sync)
   - `NOVA_AUTH_SECRET` (required with DATABASE_URL; unique random secret, 32+ characters)
   - `GEMINI_MODEL` (optional; default `gemini-3.5-flash-lite`)
   - `GROQ_MODEL` (optional; default `openai/gpt-oss-20b`)
   - `NOVA_PRIMARY_PROVIDER` (`gemini` or `groq`)
4. Deploy and check `/api/health`. Cloud sync status is available at `/api/cloud/status`.
5. Open Settings → NOVA Cloud Sync to register/login.

## Honest feature boundaries
- If `TAVILY_API_KEY` is absent, Global Intelligence generates AI-assisted planning reports only; it does not claim live market verification. Even with search, verify source links, dates, customs rules, taxes, prices and demand independently.
- AI chat/reports need a working provider key and available provider quota. Free-tier limits can change; no provider is guaranteed to be free or always available.
- Cloud sync requires a reachable PostgreSQL database and `NOVA_AUTH_SECRET`. Without them, supported records remain on this device.
- Files in the IndexedDB vault remain local; file-content cloud upload is not enabled.
- Voice depends on browser/device support and microphone permission. It is not an always-on phone-off listener.
- Money screens are manual records only. No bank balance, UPI transfer, payout, trade, purchase, message or social post is executed.
- The 3D hologram requires internet for its Three.js CDN dependency.

## Security
Never commit API keys, database URLs, passwords, OTPs or `NOVA_AUTH_SECRET`. Keep secrets only in Render Environment settings. Use a unique strong NOVA cloud password and sign out on shared devices.
