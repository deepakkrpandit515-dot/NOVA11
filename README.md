# NOVA V11 — All-in-One Project Foundation

## Included modules
- Responsive personal AI dashboard and PWA shell
- Gemini primary / Groq fallback AI backend
- Hindi voice input, speech output, and RUKO/STOP
- Business planner, global market research, import/export research, competitor analysis, customer research, opportunity radar
- Social media drafts (approval-first; no automatic publishing)
- Money tracker with CSV export (manual records only)
- Tasks, local notes/memory, local file picker, JSON backup/import
- Basic photo adjustments and local video preview
- Backend health check and provider status
- Cloud/auth/storage/research/scheduler integration checklist

## Run
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Set `GEMINI_API_KEY` and/or `GROQ_API_KEY` as server environment variables.
4. Run `npm start`; open `http://localhost:3000`.

## Render deployment
- Build: `npm install`
- Start: `npm start`
- Add provider keys in Render → Environment (never in frontend or GitHub).
- Health endpoint: `/api/health`.

## What still needs your accounts / later setup
Cloud database and authentication, private cloud file storage, reliable scheduled notifications, live web/search data sources, social publishing permissions, and Android APK packaging are not activated by this starter. The relevant modules and setup checklist are present, but integrations require provider accounts, credentials, consent, and deployment configuration. Local browser data does not sync between devices. Market/trade analysis is AI-assisted planning, not verified live data unless a research source is connected. No income is guaranteed.

## Safety and control
NOVA does not make payments, publish posts, contact customers, or execute external actions automatically. Review and approve any real-world action yourself. Do not store passwords, OTPs, banking credentials, or sensitive documents in local notes.
