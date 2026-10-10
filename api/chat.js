import { handleCors, checkAuth, enforceRateLimit } from "./_security.js";
import {
  SUPPORTED_PROVIDERS,
  PROVIDER_CONFIGS,
  getModelById,
  getDefaultModel
} from "./models.js";

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
    provider: requestedProvider,
    model = getDefaultModel(),
    systemPrompt = "",
    skillPrompt = "",
    temperature = 0.7,
    apiKey: clientApiKey = "",
    customEndpoint = ""
  } = body || {};

  // 1. Strict Rejection of OpenRouter
  const rawModel = typeof model === "string" ? model.trim() : "";
  const rawApiKey = typeof clientApiKey === "string" ? clientApiKey.trim() : "";
  const reqHeaderProvider = req.headers["x-provider"] || "";

  if (
    requestedProvider === "openrouter" ||
    reqHeaderProvider === "openrouter" ||
    rawModel.includes("openrouter") ||
    rawModel.endsWith(":free") ||
    rawApiKey.startsWith("sk-or-")
  ) {
    return res.status(400).json({
      error: "OpenRouter is not supported. RoroGPT enforces a strict free-only policy with zero paid credits and zero purchases. Please select Groq, Google Gemini, Cerebras, or Local Ollama."
    });
  }

  // 2. Reject Arbitrary Browser-Supplied Endpoints
  if (customEndpoint && typeof customEndpoint === "string" && customEndpoint.trim()) {
    return res.status(400).json({
      error: "Arbitrary custom endpoints are not permitted. Only server-configured endpoints for Groq, Gemini, Cerebras, and Local Ollama are supported."
    });
  }

  // 3. Resolve and Validate Provider and Model
  let resolvedProvider;
  let modelEntry;

  if (requestedProvider) {
    if (!SUPPORTED_PROVIDERS.includes(requestedProvider)) {
      return res.status(400).json({
        error: `Unknown provider '${requestedProvider}'. Supported free-only providers are: ${SUPPORTED_PROVIDERS.join(", ")}.`
      });
    }

    modelEntry = getModelById(rawModel);
    if (!modelEntry) {
      return res.status(400).json({
        error: `Model '${rawModel}' is not recognized in the free-only catalog.`
      });
    }

    if (modelEntry.provider !== requestedProvider) {
      return res.status(400).json({
        error: `Model '${rawModel}' belongs to provider '${modelEntry.provider}', not '${requestedProvider}'. Each model must belong to its configured provider.`
      });
    }

    resolvedProvider = requestedProvider;
  } else {
    // Backward compatibility: resolve provider strictly via server-owned catalog
    modelEntry = getModelById(rawModel);
    if (!modelEntry) {
      return res.status(400).json({
        error: `Model '${rawModel}' is not recognized in the free-only catalog. Please select an eligible model from Groq, Gemini, Cerebras, or Local Ollama.`
      });
    }

    resolvedProvider = modelEntry.provider;
  }

  const providerConfig = PROVIDER_CONFIGS[resolvedProvider];
  if (!providerConfig) {
    return res.status(400).json({
      error: `Configuration for provider '${resolvedProvider}' is not available.`
    });
  }

  // 4. API Key Resolution and Strict Provider Key Isolation
  let finalApiKey = "";

  if (providerConfig.requiresKey) {
    if (rawApiKey) {
      // Validate key prefix against provider to prevent cross-provider key leakage
      if (
        (resolvedProvider === "groq" && (rawApiKey.startsWith("AIza") || rawApiKey.startsWith("csk-"))) ||
        (resolvedProvider === "gemini" && (rawApiKey.startsWith("gsk_") || rawApiKey.startsWith("csk-"))) ||
        (resolvedProvider === "cerebras" && (rawApiKey.startsWith("gsk_") || rawApiKey.startsWith("AIza")))
      ) {
        return res.status(400).json({
          error: `The provided API key does not match provider '${resolvedProvider}'. Please provide a valid key for ${providerConfig.name}.`
        });
      }
      finalApiKey = rawApiKey;
    } else {
      // Use strictly the server-configured environment variable for this specific provider
      const envKey = (process.env[providerConfig.envKeyName] || "").trim();
      if (envKey) {
        finalApiKey = envKey;
      }
    }

    if (!finalApiKey) {
      return res.status(401).json({
        error: `No API key found for ${providerConfig.name}. Please enter your free ${providerConfig.name} key in Settings ⚙️ (${providerConfig.keyUrl}) or select Local Ollama to chat with zero keys.`
      });
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array cannot be empty." });
  }

  // 5. Target Model and Upstream Headers
  const targetModel = resolvedProvider === "ollama"
    ? modelEntry.id.replace(/^ollama\//, "")
    : resolvedProvider === "cerebras"
    ? modelEntry.id.replace(/^cerebras\//, "")
    : modelEntry.id;

  const upstreamHeaders = {
    "Content-Type": "application/json"
  };

  if (finalApiKey && providerConfig.requiresKey) {
    upstreamHeaders["Authorization"] = `Bearer ${finalApiKey}`;
  }

  const isVisionModel = Boolean(modelEntry.supportsVision);

  // 6. Format System Prompt and Active Skill Instructions
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
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      } else {
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
          textParts.push("\n[Note: An image was attached, but the active model is text-only. Please switch to Gemini 2.0 Flash or Llama 3.2 Vision to inspect images.]");
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

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const upstreamRes = await fetch(providerConfig.endpoint, {
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
        } else if (errorJson?.error) {
          errorMsg = typeof errorJson.error === "string" ? errorJson.error : JSON.stringify(errorJson.error);
        }
      } catch {
        errorMsg = await upstreamRes.text();
      }

      // Explicit detection for payment/quota issues — Never route to paid services
      const lowerErr = errorMsg.toLowerCase();
      if (
        upstreamRes.status === 402 ||
        lowerErr.includes("insufficient credit") ||
        lowerErr.includes("purchased credit") ||
        lowerErr.includes("billing") ||
        lowerErr.includes("payment required")
      ) {
        errorMsg = `The selected model '${modelEntry.name}' is unavailable under the current ${providerConfig.name} free tier access. RoroGPT operates strictly on free-tier access and never routes to paid services. Please check your provider quota or switch to another free model or Local Ollama.`;
      }

      return res.status(upstreamRes.status).json({
        error: errorMsg,
        status: upstreamRes.status
      });
    }

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
                model: parsed.model || targetModel,
                provider: resolvedProvider
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
