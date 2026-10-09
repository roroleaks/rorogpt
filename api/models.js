// Strictly Free OpenRouter Models Provider
// Every model in this list is 100% free ($0.00 / token, no credit card or paid key required)

export const CURATED_FREE_MODELS = [
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    speed: "⚡ Instant (~1s)",
    badge: "★ Best & Fastest",
    color: "#10b981", // Emerald
    icon: "⚡",
    context: "1M",
    description: "Ultra-fast response with zero thinking delay. Huge 1M context window. 100% Free."
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    speed: "🚀 Fast (~3s)",
    badge: "Top Intelligence",
    color: "#8b5cf6", // Purple
    icon: "🦙",
    context: "128K",
    description: "Meta's flagship 70B model. Superior reasoning, coding, and general knowledge. 100% Free."
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B",
    speed: "⚡ Instant (~1s)",
    badge: "Ultra Fast",
    color: "#6366f1", // Indigo
    icon: "🚀",
    context: "128K",
    description: "Extremely fast and lightweight model for instant answers and casual conversations. 100% Free."
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    name: "Qwen 2.5 Coder 32B",
    speed: "💻 Fast (~3s)",
    badge: "Best for Code",
    color: "#f59e0b", // Amber
    icon: "💻",
    context: "32K",
    description: "Specialized in Python, JS, debugging, algorithms, and clean architecture. 100% Free."
  },
  {
    id: "mistralai/mistral-small-24b-instruct-2501:free",
    name: "Mistral Small 24B",
    speed: "🌪️ Fast (~3s)",
    badge: "Balanced",
    color: "#ec4899", // Pink
    icon: "🌪️",
    context: "32K",
    description: "Mistral's latest efficient model. Crisp, concise, and nuanced answers. 100% Free."
  },
  {
    id: "deepseek/deepseek-chat:free",
    name: "DeepSeek V3",
    speed: "✨ Fast (~3s)",
    badge: "Smart",
    color: "#06b6d4", // Cyan
    icon: "✨",
    context: "64K",
    description: "DeepSeek mixture-of-experts general chat model. Smart and versatile. 100% Free."
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    speed: "🤖 Variable (~2-4s)",
    badge: "Auto Free",
    color: "#a855f7", // Fuchsia
    icon: "🤖",
    context: "Auto",
    description: "Routes requests automatically across available free models on OpenRouter. 100% Free."
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    speed: "🧠 Thinking (~30-90s)",
    badge: "Deep Reasoning",
    color: "#3b82f6", // Electric Blue
    icon: "🧠",
    context: "64K",
    description: "Chain-of-thought thinking model. Takes longer to solve complex math and logic. 100% Free."
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

    // Dynamically discover newly added free models on OpenRouter
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
            // STRICT FILTER: Only models ending in :free or openrouter/free, and absolutely NOT audio/song pricing
            .filter(m => {
              if (!m || !m.id) return false;
              const isFreeId = m.id.endsWith(":free") || m.id === "openrouter/free";
              const isAudioOrPaid = m.id.includes("lyria") || m.id.includes("paid");
              const hasZeroPrice = !m.pricing || (
                Number(m.pricing.prompt || 0) === 0 &&
                Number(m.pricing.completion || 0) === 0 &&
                Number(m.pricing.request || 0) === 0 &&
                Number(m.pricing.image || 0) === 0
              );
              return isFreeId && !isAudioOrPaid && hasZeroPrice;
            })
            .map(m => {
              const curated = CURATED_FREE_MODELS.find(c => c.id === m.id);
              return curated || {
                id: m.id,
                name: m.name || m.id.split("/").pop().replace(":free", ""),
                speed: "⚡ Free Model",
                badge: "Free",
                color: "#06b6d4",
                icon: "✨",
                context: m.context_length ? `${Math.round(m.context_length / 1024)}K` : "Free",
                description: m.description ? m.description.slice(0, 110) + "..." : "100% Free OpenRouter Model"
              };
            });
        }
      }
    } catch {
      // Fallback to curated list
    }

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
