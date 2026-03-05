const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve Chronicle as static site
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Chronicle running", hasGeminiKey: !!GEMINI_KEY, hasAnthropicKey: !!ANTHROPIC_KEY });
});

// ANTHROPIC PROXY — story generation
app.post("/api/story", async (req, res) => {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GEMINI PROXY — image generation
app.post("/api/image", async (req, res) => {
  if (!GEMINI_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not set" });
  const { prompt, style = "adult" } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const stylePrefix = style === "kids" || style === "young"
    ? "Pixar Disney animation style, bright cheerful colors, cute friendly fantasy, no violence, storybook, no text, no watermark"
    : style === "teen"
    ? "cinematic fantasy portrait, atmospheric moody lighting, ethereal, photorealistic, no text, no watermark"
    : "hyper-realistic dark fantasy 3D render, battle-scarred, dramatic cinematic lighting, photorealistic, no text, no watermark";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}, ${stylePrefix}` }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) return res.status(500).json({ error: "No image in response" });
    res.json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Chronicle running on port ${PORT}`));
