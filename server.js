const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

// CORS for hosted frontends. No credentialed cross-origin requests are used.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    backend: "online",
    aiConfigured: Boolean(OPENAI_API_KEY),
    model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    version: "NOVA V7"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim().slice(0, 8000);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
    if (!message) return res.status(400).json({ error: "Message is required." });

    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI key is not configured on the backend.",
        hint: "Add OPENAI_API_KEY in your hosting provider Environment settings."
      });
    }

    const input = [];
    for (const item of history) {
      const role = item?.role === "assistant" ? "assistant" : "user";
      const content = String(item?.content || "").slice(0, 4000);
      if (content) input.push({ role, content });
    }
    input.push({ role: "user", content: message });

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: [
          "You are NOVA 9, a helpful personal AI assistant.",
          "Reply in Hindi or Hinglish when the user does.",
          "Be practical and honest. Never claim to have searched live data or completed an external action unless a connected tool actually did it.",
          "Ask for confirmation before consequential external actions.",
          "For money and business topics, explain uncertainty and never guarantee earnings."
        ].join(" "),
        input
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = data?.error?.message || `AI provider request failed (${upstream.status}).`;
      return res.status(upstream.status).json({ error: detail });
    }

    let reply = data.output_text || "";
    if (!reply && Array.isArray(data.output)) {
      reply = data.output.flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\\n");
    }
    return res.json({ ok: true, reply: reply || "No text was returned.", model: OPENAI_MODEL });
  } catch (error) {
    console.error("NOVA 9 chat error:", error);
    return res.status(500).json({ error: "Backend error. Check server logs." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NOVA V7 listening on port ${PORT}`);
  console.log(`AI key configured: ${Boolean(OPENAI_API_KEY)}`);
});
