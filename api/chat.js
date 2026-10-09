// Universal Streaming Chat Endpoint for RoroGPT (Groq, Gemini, Cerebras, Local Ollama)
// 100% Free inference with zero paid credits required

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const {
    messages = [],
    model = "llama-3.3-70b-versatile",
    systemPrompt = "",
    temperature = 0.7,
    apiKey: clientApiKey = "",
    customEndpoint = ""
  } = body || {};

  const isLocalOllama = model.startsWith("ollama/") || customEndpoint.includes("11434");

  const headerKey = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const envKey = (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.CEREBRAS_API_KEY || "").trim();
  const finalApiKey = (clientApiKey && clientApiKey.trim()) || headerKey || envKey;

  if (!finalApiKey && !isLocalOllama) {
    return res.status(401).json({
      error: "No API key found. Please open Settings ⚙️ and paste your 100% Free API Key from Groq (https://console.groq.com/keys - Instant, no credit card, 500 tok/s) or Google AI Studio (https://aistudio.google.com/apikey - Free 1,500 req/day), or switch to Local Ollama."
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array cannot be empty." });
  }

  // Determine provider endpoint and target model
  let endpoint = "https://api.groq.com/openai/v1/chat/completions";
  let targetModel = model;
  const upstreamHeaders = {
    "Content-Type": "application/json"
  };

  if (finalApiKey) {
    upstreamHeaders["Authorization"] = `Bearer ${finalApiKey}`;
  }

  if (customEndpoint && customEndpoint.trim()) {
    endpoint = customEndpoint.trim();
  } else if (isLocalOllama) {
    // Local Ollama / Odysseus
    endpoint = "http://127.0.0.1:11434/v1/chat/completions";
    targetModel = model.replace("ollama/", "");
  } else if (finalApiKey.startsWith("csk-") || model.includes("cerebras") || targetModel === "llama3.3-70b" || targetModel === "llama3.1-8b") {
    // Cerebras Cloud (Awesome Free API)
    endpoint = "https://api.cerebras.ai/v1/chat/completions";
  } else if (finalApiKey.startsWith("AIza") || model.startsWith("gemini-")) {
    // Google Gemini (100% Free via OpenAI compatible endpoint)
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    targetModel = model.replace(":free", "");
    if (!targetModel.startsWith("gemini-")) {
      targetModel = "gemini-2.0-flash";
    }
  } else if (finalApiKey.startsWith("gsk_") || model.includes("versatile") || model.includes("instant") || model.includes("distill") || model.includes("gemma2") || model.includes("mixtral")) {
    // Groq (100% Free & Fastest - 500+ tok/s)
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    targetModel = model.replace(":free", "");
    if (!targetModel.includes("llama") && !targetModel.includes("gemma") && !targetModel.includes("mixtral") && !targetModel.includes("deepseek")) {
      targetModel = "llama-3.3-70b-versatile";
    }
  } else if (finalApiKey.startsWith("sk-or-")) {
    // OpenRouter fallback (warns if credits needed)
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    upstreamHeaders["HTTP-Referer"] = "https://rorogpt.vercel.app";
    upstreamHeaders["X-Title"] = "RoroGPT Free Chat";
    targetModel = model.endsWith(":free") ? model : `${model}:free`;
  }

  const formattedMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({
      role: "system",
      content: systemPrompt.trim()
    });
  }

  for (const msg of messages) {
    if (msg && msg.role && msg.content !== undefined) {
      formattedMessages.push({
        role: msg.role,
        content: String(msg.content)
      });
    }
  }

  const payload = {
    model: targetModel,
    messages: formattedMessages,
    temperature: typeof temperature === "number" ? temperature : 0.7,
    max_tokens: 3500,
    stream: true
  };

  try {
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(payload)
    });

    if (!upstreamRes.ok) {
      let errorMsg = `Provider error (${upstreamRes.status})`;
      try {
        const errorJson = await upstreamRes.json();
        if (errorJson?.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {
        errorMsg = await upstreamRes.text();
      }

      // Friendly translation for common OpenRouter credit issue
      if (errorMsg.includes("Insufficient credits") || errorMsg.includes("never purchased credits")) {
        errorMsg = "OpenRouter requires accounts to purchase credits. Use RoroGPT 100% FREE with ZERO payment by grabbing a free key from Groq (https://console.groq.com/keys - no card needed) or Google AI Studio (https://aistudio.google.com/apikey) and pasting it in Settings ⚙️!";
      }

      return res.status(upstreamRes.status).json({
        error: errorMsg,
        status: upstreamRes.status
      });
    }

    // Set streaming headers for real-time instant response
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    res.write(": connected\n\n");

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("data: ")) {
          const rawData = trimmed.slice(6);
          if (rawData === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }

          try {
            const parsed = JSON.parse(rawData);
            const delta = parsed.choices?.[0]?.delta || {};
            const content = delta.content || "";
            const reasoning = delta.reasoning || delta.reasoning_content || "";

            if (content || reasoning) {
              const clientPayload = JSON.stringify({
                content,
                reasoning,
                model: parsed.model || targetModel
              });
              res.write(`data: ${clientPayload}\n\n`);
            }
          } catch {
            res.write(`${trimmed}\n\n`);
          }
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      const rawData = buffer.trim().slice(6);
      if (rawData === "[DONE]") {
        res.write("data: [DONE]\n\n");
      }
    }

    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: `Connection Error: ${err.message}` });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      return res.end();
    }
  }
}
