# NOVA V8 — Android-friendly Personal AI Assistant

This package repairs the frontend/backend asset mismatch in the supplied NOVA project: the Express server serves `public/`, so the full interface, current app script, stylesheet, manifest, service worker, and Three.js avatar module are all included in `public/`.

## Run / deploy on Render
1. Extract this ZIP and upload the **contents** of `NOVA11-main` to the root of your GitHub repository (keep the `public` folder).
2. In Render, create/use a **Web Service** connected to that repository.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. In Render → Environment, add `OPENAI_API_KEY` and (optionally) `OPENAI_MODEL`. Keep the key secret; do not put it in GitHub or the browser.
5. Deploy and open `https://YOUR-SERVICE.onrender.com/api/health`. Then open the service homepage → Settings → Check Backend.

## Included
- Mobile-first NOVA interface and browser-local modules
- Voice input/output where supported by the browser; RUKO/STOP controls
- Interactive procedural 3D avatar using Three.js CDN (requires internet/WebGL)
- Express backend with `/api/health` and `/api/chat`
- PWA manifest and service worker

## Important limitations
- `/api/health` confirms server reachability, not that AI is configured. AI chat requires a valid API key, available model, and API credits.
- The 3D avatar is procedural/stylized, not a photorealistic human avatar.
- Market data, automatic global research, bank/UPI integration, payouts, social auto-posting, cloud file storage, and persistent server-side memory are not connected.
- Money entries, notes, tasks, and drafts are local browser records, not actual income or bank balances.
- Cloud hosting can keep the backend available while the phone is off; browser voice features still require the browser/app to be open. Free hosting may sleep when idle.
- Never enter passwords, OTPs, bank credentials, or API keys into notes or frontend settings.

## Local test
Requires Node.js 20+. Run `npm install` then `npm start`; open `http://localhost:10000`.
