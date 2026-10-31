# NOVA V7 — Full Project

NOVA V7 is a mobile-first 3D-styled personal AI assistant starter project.

## Included
- `public/index.html`, `public/style.css`, `public/app.js`
- `public/manifest.json`, `public/sw.js`
- `server.js`, `package.json`, `Dockerfile`, `.env.example`

## Deploy on Render (Node Web Service)
1. Upload all files and folders in this ZIP to the GitHub repository root, preserving the `public` folder.
2. Create/use a **Web Service**, not a Static Site.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Add Environment Variables in Render:
   - `OPENAI_API_KEY` = your own API key (never put it in GitHub or HTML)
   - `OPENAI_MODEL` = a model available to your API account (default in code: `gpt-5.6`)
5. Deploy. Open `https://YOUR-SERVICE.onrender.com/api/health`.
6. Open the service root URL, then Settings → Check Backend.

## Important
- A successful `/api/health` response proves only that the backend is reachable.
- AI chat also needs a valid API key and an available model.
- The 3D avatar is a CSS holographic illustration, not a real-time 3D character model.
- Live market prices, web search, bank sync, cloud file storage, scheduled background jobs, and external account actions are not connected in this starter.
- Social Media draft workspace for platform-specific post/caption and reply drafts (no automatic publishing).
- Local Photo Studio with brightness/contrast/saturation adjustments and edited-photo download.
- Video preview and original-file download (no timeline editing/rendered effects).
- Tasks, money records, social drafts, and notes are stored in the browser on that device only.
- The service can run in the cloud while the phone is off, but browser voice features require the app/browser to be open.
- Never share your API key in chat or commit it to GitHub.


## Update included (NOVA V7)
- Voice replies are read aloud using browser speech synthesis (when supported).
- RUKO now stops speech, listening, and the active chat request where the browser permits.
- Added a browser-supported install-app prompt and an SVG app icon for the PWA.
- Updated service-worker cache version so the refreshed interface can load.

## Still requires separate integrations
Live market prices, live web search, real social-account publishing, cloud file storage, bank connections, persistent server-side memory, and an actual animated 3D character are not included. These require trusted providers/assets and additional setup. The avatar currently uses a 3D-style CSS visual. Tasks, notes, drafts, and money entries are stored in this browser/device only.

The AI API currently needs a funded API account. ChatGPT subscription access and API billing are separate. Do not share API keys in chat or place them in frontend files; keep them only in the hosting provider's secret environment settings.


## NOVA V7 notes
- The animated holographic avatar is a CSS illustration, not a full 3D character model.
- Voice input depends on browser support and permissions; use a supported mobile browser. RUKO stops active voice playback/listening where supported.
- Money records and withdrawal requests are demo/local-device records. No bank, UPI, or real payout transfer is connected.
- Market and Research pages are placeholders until a data/search provider is integrated.
- Social content is saved as drafts only; no account login or automatic publishing.
- API requests require a valid server-side API key and available provider credits. Never put API keys in frontend files or share them in chat.
- Render deployment updates after the changed files are committed to the connected GitHub repository (branch: main). This ZIP has not been uploaded to GitHub or deployed automatically.


## V7 additions
- Local JSON backup and restore for tasks, notes, money records, settings, and social drafts.
- Local data clear control with confirmation.
- Backup files are not encrypted; store them privately and do not include passwords, OTPs, bank credentials, or API keys.
- Money and withdrawal screens are record-keeping/demo only; no bank account or payment network is connected.


## V7.1 additions and honest integration status
- Files: browser-local IndexedDB vault with save, list, download and delete. This is not cloud storage and may be cleared if browser data is removed.
- Research: opens a live Google search in a new browser tab. NOVA does not automatically ingest or summarize those results yet.
- Money and withdrawal: local record/demo tracker only; it never transfers money.
- Bank sync, UPI payouts, live market feeds, social auto-posting, cloud file storage, background workers and real 3D model are NOT connected. These require approved providers, credentials, permissions, and in some cases adult account ownership/KYC.
- Never enter bank passwords, OTPs, card details, or API secrets into NOVA's notes/files.


## NOVA V7 3D update (no AI API required for the 3D scene)
- The home hologram is now rendered as an actual interactive WebGL 3D scene with Three.js and procedural geometry (not a flat CSS portrait). Drag the avatar to rotate it.
- Three.js is loaded from jsDelivr CDN, so the first load of the 3D scene requires internet access. This is a stylized 3D robot/avatar, not a photorealistic human model.
- No AI API key is needed to load the UI, local modules, or 3D avatar. AI chat still requires a configured backend and provider credits.
- Local features (tasks, notes, drafts, photo preview/edit, money records, local file vault, backup/export) run in the browser. They are not bank, cloud-storage, or social-network integrations.
- Live bank balances, UPI transfers, automatic social publishing, and live market feeds are NOT included or activated by this package. Those require official provider access, permissions, and secure integration. No payment is sent by this app.

## Update existing Render service
1. Extract this ZIP.
2. In the existing GitHub NOVA11 repository, replace the project files with the contents of the extracted `NOVA_V7_FULL_PROJECT` folder (keep the `public` folder structure).
3. Commit the changes to `main`. Render is configured for auto-deploy on commits.
4. Open the Render service URL and hard-refresh/clear site cache if the old UI remains.
