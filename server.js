
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const PRIMARY_PROVIDER =
  (process.env.NOVA_PRIMARY_PROVIDER || 'gemini').toLowerCase();

const SYSTEM_PROMPT = [
  'You are NOVA, a helpful personal AI assistant.',
  'Reply clearly and practically. Use Hindi or Hinglish when the user does.',
  'Never claim actions you did not perform.',
  'Ask permission before consequential external actions.',
  'Never promise financial earnings.'
].join(' ');

const publicDir = path.join(__dirname, 'public');

const frontendDir = fs.existsSync(
  path.join(publicDir, 'index.html')
) ? publicDir : __dirname;

app.disable('x-powered-by');

app.use((req, res, next) => {
  const allowedOrigin =
    process.env.NOVA_ALLOWED_ORIGIN || '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendDir));

function makeMessages(history, message) {
  const messages = [];

  for (const item of history) {
    if (!item || typeof item !== 'object') continue;

    const role =
      item.role === 'assistant' ? 'assistant' : 'user';

    const content =
      String(item.content || '').slice(0, 4000);

    if (content) {
      messages.push({ role, content });
    }
  }

  messages.push({
    role: 'user',
    content: message
  });

  return messages;
}

// GOOGLE GEMINI AI
async function askGemini(messages) {

  const contents = messages.map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },

      contents,

      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    }),

    signal: AbortSignal.timeout(45000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Gemini request failed (${response.status})`
    );
  }

  const answer =
    (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();

  if (!answer) {
    throw new Error('Gemini returned no text.');
  }

  return {
    reply: answer,
    provider: 'Google Gemini',
    model: GEMINI_MODEL
  };
}

// GROQ AI
async function askGroq(messages) {

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model: GROQ_MODEL,

        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          ...messages
        ],

        temperature: 0.7,
        max_tokens: 2048
      }),

      signal: AbortSignal.timeout(45000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Groq request failed (${response.status})`
    );
  }

  const answer =
    data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error('Groq returned no text.');
  }

  return {
    reply: answer,
    provider: 'Groq',
    model: GROQ_MODEL
  };
}

// BACKEND HEALTH CHECK
app.get('/api/health', (_req, res) => {

  const available = [];

  if (GEMINI_API_KEY) {
    available.push('Google Gemini');
  }

  if (GROQ_API_KEY) {
    available.push('Groq');
  }

  res.json({
    ok: true,
    backend: 'online',

    aiConfigured: available.length > 0,

    provider: available.length
      ? available.join(' + ')
      : null,

    primaryProvider: PRIMARY_PROVIDER,

    model: GEMINI_API_KEY
      ? GEMINI_MODEL
      : (GROQ_API_KEY ? GROQ_MODEL : null),

    availableProviders: available,

    version: 'NOVA V10.1'
  });
});

// NOVA AI CHAT
app.post('/api/chat', async (req, res) => {

  const message =
    String(req.body?.message || '').trim();

  const history =
    Array.isArray(req.body?.history)
      ? req.body.history.slice(-12)
      : [];

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: 'Message is required.'
    });
  }

  if (message.length > 10000) {
    return res.status(413).json({
      ok: false,
      error: 'Message is too long.'
    });
  }

  if (!GEMINI_API_KEY && !GROQ_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'Add GEMINI_API_KEY and/or GROQ_API_KEY in Render Environment.'
    });
  }

  const messages = makeMessages(history, message);

  // AUTOMATIC PROVIDER FALLBACK
  const providers = PRIMARY_PROVIDER === 'groq'
    ? [
        GROQ_API_KEY ? ['Groq', askGroq] : null,
        GEMINI_API_KEY ? ['Google Gemini', askGemini] : null
      ].filter(Boolean)

    : [
        GEMINI_API_KEY ? ['Google Gemini', askGemini] : null,
        GROQ_API_KEY ? ['Groq', askGroq] : null
      ].filter(Boolean);

  const errors = [];

  for (const [name, callProvider] of providers) {

    try {

      const result = await callProvider(messages);

      return res.json({
        ok: true,
        ...result,
        fallbackUsed: errors.length > 0
      });

    } catch (err) {

      console.error(
        `${name} provider error:`,
        err.message
      );

      errors.push(`${name}: ${err.message}`);
    }
  }

  return res.status(502).json({
    ok: false,

    error:
      'All configured AI providers failed. Check API keys and provider limits.',

    details: errors
  });
});

// HOME PAGE
app.get('/', (_req, res) => {

  const indexFile =
    path.join(frontendDir, 'index.html');

  if (!fs.existsSync(indexFile)) {
    return res.status(404).send(
      'NOVA frontend not found. Put index.html inside public folder.'
    );
  }

  return res.sendFile(indexFile);
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {

  console.log(`NOVA V10.1 listening on port ${PORT}`);

  console.log(`Frontend directory: ${frontendDir}`);

  console.log(
    `Gemini configured: ${Boolean(GEMINI_API_KEY)}`
  );

  console.log(
    `Groq configured: ${Boolean(GROQ_API_KEY)}`
  );
});
