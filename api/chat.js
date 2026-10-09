// Vercel Serverless / Node.js Streaming Chat Endpoint for RoroGPT (Optimized for Low Latency)

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
    model = "google/gemini-2.0-flash-exp:free", // Default to ultra-fast Gemini 2.0 Flash
    systemPrompt = "",
    temperature = 0.7,
    apiKey: clientApiKey = ""
  } = body || {};

  const headerKey = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const envKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const finalApiKey = (clientApiKey && clientApiKey.trim()) || headerKey || envKey;

  if (!finalApiKey || !finalApiKey.startsWith("sk-or-")) {
    return res.status(401).json({
      error: "Missing OpenRouter API Key. Please click Settings ⚙️ and enter your free key from https://openrouter.ai/keys (no credit card needed)."
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array cannot be empty." });
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

  const targetModel = model || "google/gemini-2.0-flash-exp:free";

  const openRouterPayload = {
    model: targetModel,
    messages: formattedMessages,
    temperature: typeof temperature === "number" ? temperature : 0.7,
    max_tokens: 3500,
    stream: true
  };

  try {
    const upstreamRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`,
        "HTTP-Referer": "https://rorogpt.vercel.app",
        "X-Title": "RoroGPT Free Chat"
      },
      body: JSON.stringify(openRouterPayload)
    });

    if (!upstreamRes.ok) {
      let errorMsg = `OpenRouter error (${upstreamRes.status})`;
      try {
        const errorJson = await upstreamRes.json();
        if (errorJson?.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {
        errorMsg = await upstreamRes.text();
      }

      return res.status(upstreamRes.status).json({
        error: errorMsg,
        status: upstreamRes.status
      });
    }

    // Streaming SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // Immediate keepalive
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
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
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
      const payload = buffer.trim().slice(6);
      if (payload === "[DONE]") {
        res.write("data: [DONE]\n\n");
      }
    }

    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: `Server Error: ${err.message}` });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      return res.end();
    }
  }
}
