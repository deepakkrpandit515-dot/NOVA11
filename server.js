const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    backend: "online",
    app: "NOVA V11",
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY)
    }
  });
});

async function askGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini key not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }]
  }));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are NOVA, a helpful, honest personal AI assistant. Reply in the user's language, often Hindi or Hinglish. Do not claim actions you did not perform. Ask for confirmation before external actions. Do not promise income or guaranteed results." }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini error ${response.status}`);
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "Mujhe jawab nahi mila.";
}

async function askGroq(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq key not configured");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are NOVA, a helpful and honest personal AI assistant. Reply in the user's language, often Hindi or Hinglish. Never claim an action you did not perform. Ask for confirmation before external actions. Never promise income or guaranteed results." },
        ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }))
      ],
      temperature: 0.7,
      max_tokens: 1200
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Groq error ${response.status}`);
  return data?.choices?.[0]?.message?.content || "Mujhe jawab nahi mila.";
}

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required" });
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
  const messages = [...history, { role: "user", content: message }]
    .filter(m => ["user", "assistant"].includes(m.role))
    .map(m => ({ role: m.role, content: String(m.content || "").slice(0, 6000) }));

  const preferred = (process.env.NOVA_PRIMARY_PROVIDER || "gemini").toLowerCase();
  const providers = preferred === "groq" ? [askGroq, askGemini] : [askGemini, askGroq];
  const errors = [];
  for (const provider of providers) {
    try {
      const reply = await provider(messages);
      return res.json({ ok: true, reply });
    } catch (err) {
      errors.push(err.message);
    }
  }
  return res.status(503).json({
    ok: false,
    error: "No AI provider is ready. Add a Gemini or Groq API key in your hosting environment.",
    details: errors
  });
});

app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`NOVA V11 listening on ${PORT}`));
