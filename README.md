# NOVA V11 — Final consolidated project

This package consolidates the NOVA11 source project and the later V11 Gemini/Groq backend into one consistent deployment. The backend uses Node.js built-ins, so no external npm package is required. The stale V9 `public/` interface has been replaced with the full dashboard, its matching JavaScript/CSS/3D assets, and V11 branding.

## Included
- `server.js` — Gemini primary + Groq automatic fallback, health/provider status, and chat API
- `public/` — one authoritative frontend (index, app, styles, 3D scene, PWA manifest/service worker/icon)
- `package.json`, `.env.example`

## Deploy to the existing Render Web Service
1. Extract this ZIP. Upload the **contents** of the `NOVA_V11_FINAL` folder to the root of your existing `NOVA11` GitHub repository, replacing the old files. Keep the `public` folder intact.
2. Render service settings: Runtime `Node`; Build command `npm install`; Start command `npm start`.
3. In Render → Environment, keep only one entry for each variable below (no duplicate names):
   - `GEMINI_API_KEY` — optional, Google AI Studio key
   - `GROQ_API_KEY` — optional backup key
   - `GEMINI_MODEL` — optional; default `gemini-3.5-flash-lite`
   - `GROQ_MODEL` — optional; default `openai/gpt-oss-20b`
   - `NOVA_PRIMARY_PROVIDER` — optional `gemini` or `groq`; default `gemini`
4. Save and deploy. Do not add real keys to GitHub, frontend files, or chat.
5. Verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health` and `/api/providers`.
6. Open the service root URL and use Settings → Check Backend. Send a chat message; the interface will show the actual provider and model used for that successful response.

## Important status meanings
- `aiConfigured: true` means at least one key is present in the server environment. It does **not** prove that the key has quota or that the model is currently available.
- A successful `/api/chat` response includes `provider` and `model`; this is the confirmation of which provider actually answered.
- If the primary provider fails, the server tries the other configured provider. If both fail, NOVA shows an error rather than pretending a local reply came from an AI model.

## Current feature boundaries
The dashboard includes chat, browser voice controls, tasks, local money records, research shortcuts, social drafts, local files/memory and photo/video preview tools. These are not the same as live market feeds, automatic web research, bank/UPI transfers, cloud file storage, automatic social publishing, or phone-off background agents; those integrations are not included. Money and payout areas are record-keeping demos only. Income is not guaranteed. External actions remain owner-controlled and require separate trusted integrations and explicit approval.

## Local data and compatibility
The frontend retains existing `nova9_*` browser storage keys so previously saved local tasks, notes, money entries and drafts are not intentionally renamed. Backup restore accepts the previous NOVA V7 backup format as well as V11. The new service-worker cache is versioned to replace stale cached UI files.
