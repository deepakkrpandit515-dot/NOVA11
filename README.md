# NOVA V11 — Full Starter Project

## Included
- Responsive mobile-first dashboard
- AI chat backend with Gemini primary / Groq fallback
- Voice input and spoken replies where browser permissions support them
- Local tasks, notes, social drafts and manual money records
- Local photo adjustments and video preview
- Browser web search launcher
- PWA manifest and basic offline shell cache
- JSON backup and CSV money export

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`
3. Set at least one provider key in your environment:
   - `GEMINI_API_KEY` (recommended primary), or
   - `GROQ_API_KEY` (fallback)
4. Run `npm start`
5. Open `http://localhost:3000`

## Deploy to Render
- Create a Web Service from this repository.
- Build command: `npm install`
- Start command: `npm start`
- Add `GEMINI_API_KEY` and optionally `GROQ_API_KEY` in Render → Environment.
- Deploy. Open the service URL. The frontend and API are served by the same service.
- Health check: `/api/health`

## Important limitations
This is a complete runnable starter, not a fully connected global intelligence platform.
Market feeds, automatic web-page reading, cloud-synced memory/files, social account publishing,
bank integrations, payments, and guaranteed background reminders are not implemented.
Local browser records do not sync between devices. Do not store passwords, OTPs, or banking secrets.
Never put provider API keys in frontend files or GitHub.
