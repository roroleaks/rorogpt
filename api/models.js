// Curated list of high-quality Free OpenRouter models
export const CURATED_FREE_MODELS = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    tagline: "Top All-Rounder",
    badge: "Recommended",
    color: "#8b5cf6", // Purple
    icon: "🦙",
    context: "128K",
    description: "Meta's flagship 70B model. Superior reasoning, instruction following, and knowledge."
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    tagline: "Deep Reasoning",
    badge: "Thinking",
    color: "#3b82f6", // Electric Blue
    icon: "🧠",
    context: "64K",
    description: "Advanced reasoning model with chain-of-thought thinking for math, logic, and deep analysis."
  },
  {
    id: "deepseek/deepseek-chat:free",
    name: "DeepSeek V3",
    tagline: "Smart & Fast",
    badge: "Popular",
    color: "#06b6d4", // Cyan
    icon: "✨",
    context: "64K",
    description: "DeepSeek's flagship mixture-of-experts model. Extremely capable and versatile."
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    tagline: "Ultra Low Latency",
    badge: "Fastest",
    color: "#10b981", // Emerald
    icon: "⚡",
    context: "1M",
    description: "Google's next-gen Flash model. Blazing response speed with a massive context window."
  },
  {
    id: "google/gemini-2.0-flash-thinking-exp:free",
    name: "Gemini 2.0 Flash Thinking",
    tagline: "Google Reasoning",
    badge: "Thinking",
    color: "#14b8a6", // Teal
    icon: "🔮",
    context: "32K",
    description: "Gemini's dedicated thinking model that outputs its reasoning process before answering."
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    name: "Qwen 2.5 Coder 32B",
    tagline: "Coding Specialist",
    badge: "Code",
    color: "#f59e0b", // Amber
    icon: "💻",
    context: "32K",
    description: "Alibaba's dedicated code intelligence model. High precision in Python, JS, debugging, and architecture."
  },
  {
    id: "mistralai/mistral-small-24b-instruct-2501:free",
    name: "Mistral Small 24B",
    tagline: "Nuanced & Concise",
    badge: "New",
    color: "#ec4899", // Pink
    icon: "🌪️",
    context: "32K",
    description: "Mistral's latest efficient reasoning model with balanced style and accurate answers."
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B",
    tagline: "Light & Snappy",
    badge: "Fast",
    color: "#6366f1", // Indigo
    icon: "⚡",
    context: "128K",
    description: "Lightweight, ultra-fast model great for casual chat and instant lookups."
  },
  {
    id: "openrouter/auto",
    name: "OpenRouter Auto",
    tagline: "Auto Free Fallback",
    badge: "Auto",
    color: "#a855f7", // Fuchsia
    icon: "🤖",
    context: "Auto",
    description: "Automatically routes to the best available free model on OpenRouter."
  }
];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const apiKey = req.headers["authorization"]?.replace("Bearer ", "") || process.env.OPENROUTER_API_KEY;

    let dynamicFreeModels = [];

    // Optionally fetch dynamic list from OpenRouter if available
    try {
      const headers = {
        "HTTP-Referer": "https://rorogpt.vercel.app",
        "X-Title": "RoroGPT"
      };
      if (apiKey && apiKey.startsWith("sk-or-")) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const orResponse = await fetch("https://openrouter.ai/api/v1/models", {
        headers,
        signal: AbortSignal.timeout(3500)
      });

      if (orResponse.ok) {
        const data = await orResponse.json();
        if (Array.isArray(data.data)) {
          dynamicFreeModels = data.data
            .filter(m => m.id && (m.id.endsWith(":free") || (m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0")))
            .map(m => {
              const curated = CURATED_FREE_MODELS.find(c => c.id === m.id);
              return curated || {
                id: m.id,
                name: m.name || m.id.split("/").pop().replace(":free", ""),
                tagline: "Free OpenRouter Model",
                badge: "Free",
                color: "#06b6d4",
                icon: "✨",
                context: m.context_length ? `${Math.round(m.context_length / 1024)}K` : "Free",
                description: m.description ? m.description.slice(0, 120) + "..." : "Available via OpenRouter free tier"
              };
            });
        }
      }
    } catch {
      // Ignore network timeout, fallback to curated list
    }

    // Combine curated with any dynamically found free models (avoiding duplicates)
    const seen = new Set();
    const finalModels = [];

    for (const m of CURATED_FREE_MODELS) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        finalModels.push(m);
      }
    }

    for (const m of dynamicFreeModels) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        finalModels.push(m);
      }
    }

    return res.status(200).json({
      success: true,
      hasServerKey: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 5),
      models: finalModels
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      hasServerKey: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 5),
      models: CURATED_FREE_MODELS
    });
  }
}
