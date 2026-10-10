import { handleCors, checkAuth, enforceRateLimit } from "./_security.js";

export default async function handler(req, res) {
  if (!handleCors(req, res, "POST, OPTIONS")) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!enforceRateLimit(req, res, "chat")) {
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  req.body = body;

  if (!checkAuth(req, res)) {
    return;
  }

  const {
    messages = [],
    model = "qwen/qwen3.8-27b",
    systemPrompt = "",
    temperature = 0.7,
    apiKey: clientApiKey = "",
    customEndpoint = ""
  } = body || {};

  const isLocalOllama = model.startsWith("ollama/") || customEndpoint.includes("11434");

  let headerKey = req.headers["authorization"]?.replace("Bearer ", "").trim() || "";
  if (headerKey && process.env.APP_API_TOKEN && headerKey === process.env.APP_API_TOKEN) {
    headerKey = ""; // App access token, not upstream provider key
  }
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
    endpoint = "http://127.0.0.1:11434/v1/chat/completions";
    targetModel = model.replace("ollama/", "");
  } else if (finalApiKey.startsWith("csk-") || model.includes("cerebras") || targetModel === "llama3.3-70b" || targetModel === "llama3.1-8b") {
    endpoint = "https://api.cerebras.ai/v1/chat/completions";
  } else if (finalApiKey.startsWith("AIza") || model.startsWith("gemini-")) {
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    targetModel = model.replace(":free", "");
    if (!targetModel.startsWith("gemini-")) {
      targetModel = "gemini-2.0-flash";
    }
  } else if (finalApiKey.startsWith("gsk_") || model.includes("qwen") || model.includes("gpt-oss") || model.includes("allam") || model.includes("llama") || model.includes("versatile") || model.includes("instant") || model.includes("distill")) {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    targetModel = model.replace(":free", "");

    // Robust model translation to active Groq models (prevents "model does not exist" errors)
    if (targetModel.includes("vision")) {
      targetModel = "llama-3.2-11b-vision-preview";
    } else if (targetModel.includes("120b") || targetModel.includes("r1") || targetModel.includes("70b")) {
      targetModel = "openai/gpt-oss-120b";
    } else if (targetModel.includes("20b")) {
      targetModel = "openai/gpt-oss-20b";
    } else if (targetModel.includes("allam")) {
      targetModel = "allam-2-7b";
    } else if (targetModel.includes("qwen")) {
      targetModel = "qwen/qwen3.8-27b";
    } else {
      targetModel = "qwen/qwen3.8-27b";
    }
  } else if (finalApiKey.startsWith("sk-or-")) {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    upstreamHeaders["HTTP-Referer"] = "https://rorogpt.vercel.app";
    upstreamHeaders["X-Title"] = "RoroGPT Free Chat";
    targetModel = model.endsWith(":free") ? model : `${model}:free`;
  }

  // Determine if target model supports multimodal vision
  const isVisionModel = targetModel.includes("vision") || targetModel.startsWith("gemini-");

  // Format system prompt and active skill instructions
  const { skillPrompt = "" } = body || {};
  let effectiveSystemPrompt = (systemPrompt || "").trim();
  if (skillPrompt && typeof skillPrompt === "string" && skillPrompt.trim()) {
    effectiveSystemPrompt = effectiveSystemPrompt
      ? `${effectiveSystemPrompt}\n\n=== Active Skill Instructions ===\n${skillPrompt.trim()}\n=== End Skill Instructions ===`
      : `=== Active Skill Instructions ===\n${skillPrompt.trim()}\n=== End Skill Instructions ===`;
  }

  const formattedMessages = [];
  if (effectiveSystemPrompt) {
    formattedMessages.push({
      role: "system",
      content: effectiveSystemPrompt
    });
  }

  for (const msg of messages) {
    if (!msg || !msg.role || msg.content === undefined) continue;

    if (Array.isArray(msg.content)) {
      if (isVisionModel) {
        // Model supports multimodal vision array directly
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      } else {
        // Fallback for text-only models: extract text blocks and note image attachments
        const textParts = [];
        let hasImage = false;
        for (const part of msg.content) {
          if (part?.type === "text" && part.text) {
            textParts.push(part.text);
          } else if (part?.type === "image_url") {
            hasImage = true;
          }
        }
        if (hasImage) {
          textParts.push("\n[Note: An image was attached, but the active model is text-only. Please switch to Gemini 2.0 Flash or Llama 3.2 Vision in the top bar to inspect images.]");
        }
        formattedMessages.push({
          role: msg.role,
          content: textParts.join("\n") || "(attached content)"
        });
      }
    } else {
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

  // Upstream connection management with early abort on client disconnect
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
      signal: abortController.signal
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

      if (errorMsg.includes("Insufficient credits") || errorMsg.includes("never purchased credits")) {
        errorMsg = "OpenRouter requires accounts to purchase credits. Use RoroGPT 100% FREE with ZERO payment by grabbing a free key from Groq (https://console.groq.com/keys - no card needed) or Google AI Studio (https://aistudio.google.com/apikey) and pasting it in Settings ⚙️!";
      }

      return res.status(upstreamRes.status).json({
        error: errorMsg,
        status: upstreamRes.status
      });
    }

    // Set streaming headers for instant real-time response
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

    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (err) {
    if (abortController.signal.aborted) {
      return res.end();
    }
    if (!res.headersSent) {
      return res.status(500).json({ error: `Connection Error: ${err.message}` });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      return res.end();
    }
  }
}
