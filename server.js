
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// ========================================
// NOVA V11 CONFIGURATION
// ========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const PRIMARY_PROVIDER =
  (process.env.NOVA_PRIMARY_PROVIDER || 'gemini').toLowerCase();

const TIMEOUT = 45000;

const SYSTEM_PROMPT = `
You are NOVA, a helpful personal AI assistant.

Your purpose:
- Help with everyday tasks.
- Understand Hindi, English and Hinglish.
- Reply in the user's language.
- Help with coding, technology and business.
- Explain difficult things simply.
- Give accurate and practical answers.
- Never claim an action was completed if it was not.
- Never claim to be ChatGPT or GPT-4.
- Never guess your model identity.
- Never promise guaranteed income.
- Ask permission before consequential external actions.

You are NOVA. Be helpful, honest and friendly.
`;

// ========================================
// FRONTEND DIRECTORY
// ========================================

const publicDir = path.join(__dirname, 'public');

const frontendDir = fs.existsSync(
  path.join(publicDir, 'index.html')
) ? publicDir : __dirname;

app.disable('x-powered-by');

// ========================================
// CORS
// ========================================

app.use((req, res, next) => {
  const origin =
    process.env.NOVA_ALLOWED_ORIGIN || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
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

// ========================================
// MESSAGE HISTORY
// ========================================

function makeMessages(history, message) {
  const messages = [];

  const items = Array.isArray(history)
    ? history.slice(-12)
    : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const role =
      item.role === 'assistant' ||
      item.role === 'user'
        ? item.role
        : null;

    if (!role) continue;

    const content = String(item.content || '')
      .trim()
      .slice(0, 4000);

    if (!content) continue;

    const previous = messages[messages.length - 1];

    if (previous && previous.role === role) {
      previous.content += '\n' + content;
    } else {
      messages.push({ role, content });
    }
  }

  while (
    messages.length &&
    messages[0].role === 'assistant'
  ) {
    messages.shift();
  }

  const last = messages[messages.length - 1];

  if (last && last.role === 'user') {
    last.content += '\n' + message;
  } else {
    messages.push({
      role: 'user',
      content: message
    });
  }

  return messages;
}

// ========================================
// RESPONSE READER
// ========================================

async function readResponse(response) {
  const body = await response.text();

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

function createProviderError(name, status, data) {
  const message =
    data?.error?.message ||
    data?.message ||
    'Unknown provider error';

  return new Error(
    `${name} HTTP ${status}: ${String(message).slice(0, 500)}`
  );
}

// ========================================
// GEMINI AI
// ========================================

async function askGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key missing.');
  }

  const contents = messages.map(item => ({
    role: item.role === 'assistant'
      ? 'model'
      : 'user',

    parts: [{ text: item.content }]
  }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
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

    signal: AbortSignal.timeout(TIMEOUT)
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw createProviderError(
      'Gemini',
      response.status,
      data
    );
  }

  const answer = (
    data?.candidates?.[0]?.content?.parts || []
  )
    .map(part => part.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!answer) {
    throw new Error(
      'Gemini returned no answer.'
    );
  }

  return {
    reply: answer,
    provider: 'Google Gemini',
    model: GEMINI_MODEL
  };
}

// ========================================
// GROQ AI
// ========================================

async function askGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key missing.');
  }

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

        max_completion_tokens: 2048
      }),

      signal: AbortSignal.timeout(TIMEOUT)
    }
  );

  const data = await readResponse(response);

  if (!response.ok) {
    throw createProviderError(
      'Groq',
      response.status,
      data
    );
  }

  const answer =
    data?.choices?.[0]?.message?.content;

  if (
    typeof answer !== 'string' ||
    !answer.trim()
  ) {
    throw new Error('Groq returned no answer.');
  }

  return {
    reply: answer.trim(),
    provider: 'Groq',
    model: GROQ_MODEL
  };
}

// ========================================
// PROVIDER SELECTION
// ========================================

function getProviders() {
  const providers = {
    gemini: {
      name: 'Google Gemini',
      model: GEMINI_MODEL,
      enabled: Boolean(GEMINI_API_KEY),
      call: askGemini
    },

    groq: {
      name: 'Groq',
      model: GROQ_MODEL,
      enabled: Boolean(GROQ_API_KEY),
      call: askGroq
    }
  };

  const order = PRIMARY_PROVIDER === 'groq'
    ? ['groq', 'gemini']
    : ['gemini', 'groq'];

  return order
    .map(key => providers[key])
    .filter(provider => provider.enabled);
}

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/health', (_req, res) => {
  const providers = getProviders();

  res.json({
    ok: true,
    backend: 'online',
    aiConfigured: providers.length > 0,

    primaryProvider: PRIMARY_PROVIDER,

    availableProviders: providers.map(p => p.name),

    models: {
      gemini: GEMINI_API_KEY
        ? GEMINI_MODEL
        : null,

      groq: GROQ_API_KEY
        ? GROQ_MODEL
        : null
    },

    version: 'NOVA V11'
  });
});

// ========================================
// PROVIDER STATUS
// ========================================

app.get('/api/providers', (_req, res) => {
  res.json({
    ok: true,

    primary: PRIMARY_PROVIDER,

    gemini: {
      configured: Boolean(GEMINI_API_KEY),
      model: GEMINI_API_KEY
        ? GEMINI_MODEL
        : null
    },

    groq: {
      configured: Boolean(GROQ_API_KEY),
      model: GROQ_API_KEY
        ? GROQ_MODEL
        : null
    },

    version: 'NOVA V11'
  });
});

// ========================================
// NOVA CHAT
// ========================================

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(
      req.body?.message || ''
    ).trim();

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

    const providers = getProviders();

    if (!providers.length) {
      return res.status(503).json({
        ok: false,
        error: 'No AI provider configured.'
      });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const messages = makeMessages(
      history,
      message
    );

    const errors = [];

    for (const provider of providers) {
      try {
        console.log(
          `NOVA trying provider: ${provider.name}`
        );

        const result = await provider.call(messages);

        console.log(
          `NOVA success: ${provider.name}`
        );

        return res.json({
          ok: true,
          ...result,
          fallbackUsed: errors.length > 0,
          version: 'NOVA V11'
        });

      } catch (error) {
        console.error(
          `${provider.name} failed:`,
          error.message
        );

        errors.push({
          provider: provider.name,
          error: error.message
        });
      }
    }

    return res.status(502).json({
      ok: false,
      error: 'All AI providers failed.',
      details: errors,
      suggestion:
        'Check API keys, model access and provider quota.'
    });

  } catch (error) {
    console.error(
      'NOVA chat error:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      error: 'Internal NOVA server error.'
    });
  }
});

// ========================================
// HOME PAGE
// ========================================

app.get('/', (_req, res) => {
  const indexFile = path.join(
    frontendDir,
    'index.html'
  );

  if (!fs.existsSync(indexFile)) {
    return res.status(404).send(
      'NOVA frontend not found.'
    );
  }

  return res.sendFile(indexFile);
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((err, _req, res, _next) => {
  console.error(
    'Server error:',
    err.message
  );

  res.status(500).json({
    ok: false,
    error: 'NOVA server error.'
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================');
  console.log('       NOVA V11 ONLINE');
  console.log('================================');

  console.log(`Port: ${PORT}`);
  console.log(`Frontend: ${frontendDir}`);

  console.log(
    `Gemini configured: ${Boolean(GEMINI_API_KEY)}`
  );

  console.log(
    `Groq configured: ${Boolean(GROQ_API_KEY)}`
  );

  console.log(
    `Primary provider: ${PRIMARY_PROVIDER}`
  );

  console.log('Automatic fallback: ENABLED');
  console.log('================================');
});
