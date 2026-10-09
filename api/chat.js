// Vercel Serverless / Node.js Streaming Chat Endpoint for RoroGPT

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Parse body if not already parsed
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
    model = "meta-llama/llama-3.3-70b-instruct:free",
    systemPrompt = "",
    temperature = 0.7,
    apiKey: clientApiKey = ""
  } = body || {};

  // Resolve API Key: Client Key > Header Bearer > Server Env
  const headerKey = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const envKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const finalApiKey = (clientApiKey && clientApiKey.trim()) || headerKey || envKey;

  if (!finalApiKey || !finalApiKey.startsWith("sk-or-")) {
    return res.status(401).json({
      error: "Missing or invalid OpenRouter API Key. Please click Settings ⚙️ in RoroGPT and enter your API key, or set OPENROUTER_API_KEY in your Vercel Environment Variables / .env file."
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array cannot be empty." });
  }

  // Prepare messages array with optional system prompt
  const formattedMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({
      role: "system",
      content: systemPrompt.trim()
    });
  }

  // Append conversation messages
  for (const msg of messages) {
    if (msg && msg.role && msg.content !== undefined) {
      formattedMessages.push({
        role: msg.role,
        content: String(msg.content)
      });
    }
  }

  const openRouterPayload = {
    model: model || "meta-llama/llama-3.3-70b-instruct:free",
    messages: formattedMessages,
    temperature: typeof temperature === "number" ? temperature : 0.7,
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

    // Set streaming headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

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
                model: parsed.model || model
              });
              res.write(`data: ${clientPayload}\n\n`);
            }
          } catch {
            // Forward raw data if parsing fails
            res.write(`${trimmed}\n\n`);
          }
        }
      }
    }

    // Flush any leftover buffer
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
      return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      return res.end();
    }
  }
}
