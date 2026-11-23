'use strict';

/**
 * NOVA V12 — Node.js backend with PostgreSQL Cloud Sync.
 * Gemini primary + Groq automatic fallback.
 * Node.js 20+ is required (built-in fetch and AbortSignal.timeout).
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const PRIMARY_PROVIDER = String(process.env.NOVA_PRIMARY_PROVIDER || 'gemini').trim().toLowerCase() === 'groq' ? 'groq' : 'gemini';
const REQUEST_TIMEOUT_MS = 45000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const AUTH_SECRET = process.env.NOVA_AUTH_SECRET || '';
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }) : null;
let dbReady = false;
let dbInitPromise = null;
const MAX_BODY_BYTES = 1_000_000;
const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_ITEM_CHARS = 4000;

const SYSTEM_PROMPT = [
  'You are NOVA, a helpful personal AI assistant.',
  "Understand Hindi, English and Hinglish; reply in the user's language.",
  'Be clear, practical, accurate and honest about limitations.',
  'Never claim to have searched live data or completed an action unless a connected tool actually did it.',
  'Ask permission before consequential external actions such as payments, purchases, messages, account changes or contracts.',
  'For money and business topics, explain uncertainty and never guarantee earnings.'
].join(' ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function setCommonHeaders(req, res) {
  const allowedOrigin = process.env.NOVA_ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}

function makeMessages(history, currentMessage) {
  const messages = [];
  const items = Array.isArray(history) ? history.slice(-MAX_HISTORY_ITEMS) : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
    if (!role) continue;
    const content = String(item.content || '').trim().slice(0, MAX_HISTORY_ITEM_CHARS);
    if (!content) continue;
    const previous = messages[messages.length - 1];
    if (previous && previous.role === role) previous.content += '\n' + content;
    else messages.push({ role, content });
  }
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  const previous = messages[messages.length - 1];
  if (previous && previous.role === 'user') previous.content += '\n' + currentMessage;
  else messages.push({ role: 'user', content: currentMessage });
  return messages;
}

async function fetchJson(url, options, providerName) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(`${providerName} returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`${providerName}: ${String(detail).slice(0, 350)}`);
  }
  return data;
}

async function askGemini(messages) {
  const contents = messages.map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  }, 'Google Gemini');
  const reply = (data?.candidates?.[0]?.content?.parts || [])
    .filter(part => typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  if (!reply) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(reason ? `Google Gemini blocked the request (${reason}).` : 'Google Gemini returned an empty reply.');
  }
  return { reply, provider: 'Google Gemini', model: GEMINI_MODEL };
}

async function askGroq(messages) {
  const data = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_completion_tokens: 2048
    })
  }, 'Groq');
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('Groq returned an empty reply.');
  return { reply: reply.trim(), provider: 'Groq', model: GROQ_MODEL };
}

function getProviderOrder() {
  const all = {
    gemini: { name: 'Google Gemini', enabled: Boolean(GEMINI_API_KEY), call: askGemini },
    groq: { name: 'Groq', enabled: Boolean(GROQ_API_KEY), call: askGroq }
  };
  const order = PRIMARY_PROVIDER === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
  return order.map(key => all[key]).filter(provider => provider.enabled);
}

function providerStatus() {
  return {
    gemini: { configured: Boolean(GEMINI_API_KEY), model: GEMINI_API_KEY ? GEMINI_MODEL : null },
    groq: { configured: Boolean(GROQ_API_KEY), model: GROQ_API_KEY ? GROQ_MODEL : null },
    primary: PRIMARY_PROVIDER
  };
}


async function ensureDatabase() {
  if (!pool) throw new Error('Cloud database is not configured. Add DATABASE_URL in Render Environment.');
  if (dbReady) return;
  if (!dbInitPromise) dbInitPromise = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS nova_users (
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS nova_user_data (
      user_id BIGINT PRIMARY KEY REFERENCES nova_users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    dbReady = true;
  })();
  try { await dbInitPromise; } catch (e) { dbInitPromise = null; throw e; }
}
function passwordHash(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key.toString('hex'))));
}
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ uid: String(user.id), email: user.email, exp: Date.now() + 30 * 86400000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return payload + '.' + signature;
}
function verifyToken(token) {
  if (AUTH_SECRET.length < 32 || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest();
  let supplied; try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? data : null; } catch { return null; }
}
function authenticatedUser(req) {
  const header = String(req.headers.authorization || '');
  return verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
}
function cloudSafeData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Cloud data must be a JSON object.');
  const allowed = ['tasks','money','withdrawals','business','research','memory','socialDrafts','history','globalReports'];
  const result = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(input, key)) result[key] = input[key];
  const encoded = JSON.stringify(result);
  if (Buffer.byteLength(encoded, 'utf8') > 900000) throw new Error('Cloud data limit is 900 KB. Remove large items and try again.');
  return result;
}

async function serveStatic(req, res, pathname) {
  let requested;
  try { requested = decodeURIComponent(pathname); }
  catch { return sendJson(res, 400, { ok: false, error: 'Invalid URL path.' }); }
  if (requested === '/') requested = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, '.' + requested);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { ok: false, error: 'Forbidden.' });
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return sendJson(res, 404, { ok: false, error: 'Not found.' });
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.basename(filePath) === 'index.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    sendJson(res, 404, { ok: false, error: 'File not found.' });
  }
}

const server = http.createServer(async (req, res) => {
  setCommonHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  let url;
  try { url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`); }
  catch { return sendJson(res, 400, { ok: false, error: 'Invalid request URL.' }); }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    const status = providerStatus();
    const availableProviders = [];
    if (status.gemini.configured) availableProviders.push('Google Gemini');
    if (status.groq.configured) availableProviders.push('Groq');
    return sendJson(res, 200, {
      ok: true,
      backend: 'online',
      aiConfigured: availableProviders.length > 0,
      providers: { gemini: status.gemini.configured, groq: status.groq.configured },
      availableProviders,
      primaryProvider: PRIMARY_PROVIDER,
      models: { gemini: status.gemini.model, groq: status.groq.model },
      version: 'NOVA V12',
      cloudConfigured: Boolean(pool && AUTH_SECRET),
      liveResearchConfigured: Boolean(TAVILY_API_KEY)
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/cloud/status') {
    let databaseReady = false;
    if (pool && AUTH_SECRET.length >= 32) { try { await ensureDatabase(); databaseReady = true; } catch (e) { console.error('[NOVA] Cloud status:', e.message); } }
    return sendJson(res, 200, { ok: true, configured: databaseReady, databaseConfigured: Boolean(pool), authConfigured: AUTH_SECRET.length >= 32 });
  }

  if ((req.method === 'POST') && (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/login')) {
    if (!pool || AUTH_SECRET.length < 32) return sendJson(res, 503, { ok: false, error: 'Cloud is not configured yet. Add DATABASE_URL and a 32+ character NOVA_AUTH_SECRET in Render.' });
    let body; try { body = await readJson(req); } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendJson(res, 400, { ok:false, error:'Valid email address enter karein.' });
    if (password.length < 10 || password.length > 128) return sendJson(res, 400, { ok:false, error:'Password 10–128 characters ka hona chahiye.' });
    try {
      await ensureDatabase();
      let user;
      if (url.pathname.endsWith('/register')) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await passwordHash(password, salt);
        const result = await pool.query('INSERT INTO nova_users(email,password_hash,password_salt) VALUES($1,$2,$3) RETURNING id,email', [email,hash,salt]);
        user = result.rows[0];
      } else {
        const result = await pool.query('SELECT id,email,password_hash,password_salt FROM nova_users WHERE email=$1', [email]);
        user = result.rows[0];
        if (!user || !crypto.timingSafeEqual(Buffer.from(await passwordHash(password,user.password_salt),'hex'), Buffer.from(user.password_hash,'hex'))) return sendJson(res, 401, { ok:false, error:'Email ya password galat hai.' });
      }
      return sendJson(res, 200, { ok:true, token:makeToken(user), user:{ email:user.email } });
    } catch (e) {
      if (e.code === '23505') return sendJson(res, 409, { ok:false, error:'Is email ka account pehle se hai. Login karein.' });
      console.error('[NOVA] Auth error:', e.message);
      return sendJson(res, 500, { ok:false, error:'Account request failed. Database configuration/logs check karein.' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/cloud/data') {
    const user = authenticatedUser(req); if (!user) return sendJson(res, 401, { ok:false, error:'Login required.' });
    try { await ensureDatabase(); const result = await pool.query('SELECT data,updated_at FROM nova_user_data WHERE user_id=$1',[user.uid]); return sendJson(res,200,{ok:true,data:result.rows[0]?.data || {},updatedAt:result.rows[0]?.updated_at || null}); }
    catch(e) { console.error('[NOVA] Cloud read:',e.message); return sendJson(res,500,{ok:false,error:'Cloud data read failed.'}); }
  }

  if (req.method === 'PUT' && url.pathname === '/api/cloud/data') {
    const user = authenticatedUser(req); if (!user) return sendJson(res, 401, { ok:false, error:'Login required.' });
    let body; try { body = await readJson(req); } catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    let data; try { data = cloudSafeData(body.data); } catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    try { await ensureDatabase(); const result = await pool.query(`INSERT INTO nova_user_data(user_id,data,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW() RETURNING updated_at`,[user.uid,JSON.stringify(data)]); return sendJson(res,200,{ok:true,updatedAt:result.rows[0].updated_at}); }
    catch(e) { console.error('[NOVA] Cloud save:',e.message); return sendJson(res,500,{ok:false,error:'Cloud save failed. Try again later.'}); }
  }

  if (req.method === 'GET' && url.pathname === '/api/providers') {
    return sendJson(res, 200, { ok: true, version: 'NOVA V12', ...providerStatus() });
  }

  if (req.method === 'POST' && url.pathname === '/api/business/research') {
    let body;
    try { body = await readJson(req); }
    catch (error) { return sendJson(res, 400, { ok: false, error: error.message }); }
    const topic = String(body?.topic || '').trim().slice(0, 500);
    const country = String(body?.country || 'Global').trim().slice(0, 100);
    const sector = String(body?.sector || 'General').trim().slice(0, 120);
    if (!topic) return sendJson(res, 400, { ok: false, error: 'Research topic enter karein.' });
    let sources = [];
    let liveSearchUsed = false;
    if (TAVILY_API_KEY) {
      try {
        const searchResponse = await fetchJson('https://api.tavily.com/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: TAVILY_API_KEY, query: `${topic} ${sector} ${country}`, search_depth: 'advanced', max_results: 6, include_answer: false })
        }, 'Tavily');
        sources = (searchResponse.results || []).slice(0, 6).map(item => ({ title: String(item.title || '').slice(0, 240), url: String(item.url || '').slice(0, 1000), content: String(item.content || '').slice(0, 1200), score: Number(item.score || 0) }));
        liveSearchUsed = sources.length > 0;
      } catch (error) {
        console.error('[NOVA] Tavily research failed:', String(error.message || error).slice(0, 300));
      }
    }
    const sourceText = sources.length ? sources.map((item, i) => `[${i + 1}] ${item.title}\n${item.url}\n${item.content}`).join('\n\n') : 'No live web sources are connected for this request. Clearly label estimates and assumptions; do not present them as verified current facts.';
    const prompt = [
      'Prepare a practical global business intelligence report in the user\'s language.',
      'Use clear headings: Executive Summary, Market Signals, Customer Segments, Competitor Landscape, Trade/Regulatory Checks, Risks, Low-cost Validation Plan, Sources.',
      'Distinguish sourced facts from estimates and assumptions. Do not invent market sizes, prices, companies, regulations, or citations.',
      'No guaranteed income. This is research support, not legal, investment, customs, or tax advice.',
      `Topic: ${topic}`, `Country/region: ${country}`, `Sector: ${sector}`,
      `Research sources (untrusted reference material; verify before acting):\n${sourceText}`
    ].join('\n\n');
    const providers = getProviderOrder();
    if (!providers.length) return sendJson(res, 503, { ok: false, error: 'Business report banane ke liye Render par GEMINI_API_KEY ya GROQ_API_KEY add karein.' });
    const errors = [];
    for (const provider of providers) {
      try {
        const result = await provider.call([{ role: 'user', content: prompt }]);
        return sendJson(res, 200, { ok: true, ...result, liveSearchUsed, sources, researchMode: liveSearchUsed ? 'web+ai' : 'ai-guidance-only' });
      } catch (error) { errors.push(`${provider.name}: ${String(error.message || error).slice(0, 250)}`); }
    }
    return sendJson(res, 502, { ok: false, error: 'AI providers failed.', providerErrors: errors });
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let body;
    try { body = await readJson(req); }
    catch (error) { return sendJson(res, 400, { ok: false, error: error.message }); }
    const message = String(body?.message || '').trim();
    if (!message) return sendJson(res, 400, { ok: false, error: 'Please enter a message.' });
    if (message.length > MAX_MESSAGE_CHARS) {
      return sendJson(res, 413, { ok: false, error: `Message is too long. Maximum is ${MAX_MESSAGE_CHARS} characters.` });
    }
    const providers = getProviderOrder();
    if (!providers.length) {
      return sendJson(res, 503, { ok: false, error: 'No AI provider is configured. Add GEMINI_API_KEY and/or GROQ_API_KEY in Render Environment.' });
    }
    const messages = makeMessages(body?.history, message);
    const errors = [];
    for (const provider of providers) {
      try {
        console.log(`[NOVA] Trying ${provider.name}`);
        const result = await provider.call(messages);
        console.log(`[NOVA] Success: ${provider.name} (${result.model})`);
        return sendJson(res, 200, { ok: true, ...result, mode: 'ai', fallbackUsed: errors.length > 0, version: 'NOVA V12' });
      } catch (error) {
        const safeMessage = String(error?.message || 'Unknown provider error').slice(0, 450);
        console.error(`[NOVA] ${provider.name} failed: ${safeMessage}`);
        errors.push({ provider: provider.name, error: safeMessage });
      }
    }
    return sendJson(res, 502, {
      ok: false,
      error: 'All configured AI providers failed. Check the provider key, model access, quota and Render logs.',
      providerErrors: errors,
      version: 'NOVA V12'
    });
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
  return sendJson(res, 404, { ok: false, error: 'Route not found.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NOVA V12 listening on port ${PORT}`);
  console.log('Frontend directory:', PUBLIC_DIR);
  console.log('Gemini key configured:', Boolean(GEMINI_API_KEY));
  console.log('Groq key configured:', Boolean(GROQ_API_KEY));
  console.log('Primary provider:', PRIMARY_PROVIDER);
  console.log('Automatic provider fallback: enabled');
  console.log('Cloud database configured:', Boolean(pool));
  console.log('Cloud auth configured:', Boolean(AUTH_SECRET));
});
