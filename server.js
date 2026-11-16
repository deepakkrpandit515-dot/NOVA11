
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// NOVA system identity
const SYSTEM_PROMPT = `
You are NOVA, a personal AI assistant.
You are helpful, intelligent and respectful.
Reply in Hindi or Hinglish when the user uses Hindi.
Help with learning, research, business ideas and daily tasks.
Never claim an action was completed unless it really was.
Ask permission before external actions.
Do not guarantee income or profits.
`;

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    backend: "online",
    aiConfigured: !!process.env.GEMINI_API_KEY,
    provider: "Google Gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    version: "NOVA V10"
  });
});

// NOVA AI Chat
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        error: "Gemini API key missing. Add GEMINI_API_KEY in Render."
      });
    }

    const message =
      req.body.message ||
      req.body.prompt ||
      req.body.text;

    if (!message && !Array.isArray(req.body.messages)) {
      return res.status(400).json({
        ok: false,
        error: "Message is required."
      });
    }

    const history = Array.isArray(req.body.messages)
      ? req.body.messages
          .filter(m => m && (m.role === "user" || m.role === "assistant"))
          .slice(-20)
          .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content || m.text || "") }]
          }))
          .filter(m => m.parts[0].text.trim())
      : [
          {
            role: "user",
            parts: [{ text: String(message) }]
          }
        ];

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: history,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        ok: false,
        error: data.error?.message || "Gemini API request failed."
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "NOVA received an empty AI response."
      });
    }

    res.json({
      ok: true,
      reply,
      text: reply,
      provider: "Google Gemini",
      model
    });

  } catch (error) {
    console.error("NOVA error:", error);

    res.status(500).json({
      ok: false,
      error: "NOVA server error: " + error.message
    });
  }
});

// Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`NOVA V10 running on port ${PORT}`);
});
