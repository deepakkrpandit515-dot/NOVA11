# NOVA 9 — Full Project

NOVA 9 is a mobile-first 3D-styled personal AI assistant starter project.

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
