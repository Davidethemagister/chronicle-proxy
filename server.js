const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Allow requests from anywhere (Claude artifacts, your deployed app, etc.)
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Chronicle Proxy running", hasKey: !!GEMINI_KEY });
});

// Image generation endpoint
// POST /image  { prompt: "...", style: "adult"|"kids" }
app.post("/image", async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set on server" });
  }

  const { prompt, style = "adult" } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // Style prefix based on age group
  const stylePrefix = style === "kids" || style === "young"
    ? "Pixar Disney animation style, bright cheerful colors, cute friendly fantasy character, no violence, storybook illustration, no text, no watermark"
    : style === "teen"
    ? "cinematic fantasy portrait, atmospheric moody lighting, intricate costume, ethereal quality, photorealistic render, no text, no watermark"
    : "hyper-realistic dark fantasy 3D render, battle-scarred gritty warrior, dramatic cinematic lighting, intense expression, photorealistic, no text, no watermark";

  const fullPrompt = `${prompt}, ${stylePrefix}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) {
      return res.status(500).json({ error: "No image returned from Gemini" });
    }

    // Return base64 image data
    res.json({
      image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      mimeType: part.inlineData.mimeType,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Chronicle proxy running on port ${PORT}`);
});
