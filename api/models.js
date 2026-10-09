// 100% Free AI Models Provider (Zero Paid Keys, Zero Subscription, Zero Credit Card)
// Supports: Groq (100% Free & World's Fastest), Google Gemini (100% Free), Cerebras (Ultra-Fast), and Local Ollama / Odysseus

export const FREE_MODELS_BY_PROVIDER = {
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B (Groq)",
      provider: "groq",
      speed: "⚡ 500 tok/s (~0.3s)",
      badge: "★ Best & Fastest",
      color: "#f59e0b",
      icon: "⚡",
      context: "128K",
      description: "100% Free on Groq. Meta's flagship 70B intelligence running on ultra-fast LPU hardware with zero wait time."
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B (Groq)",
      provider: "groq",
      speed: "🚀 800 tok/s (Instant)",
      badge: "Instant 0.2s",
      color: "#10b981",
      icon: "🚀",
      context: "128K",
      description: "100% Free on Groq. Instant 8B model. Generates full answers in 0.2 seconds flat."
    },
    {
      id: "deepseek-r1-distill-llama-70b",
      name: "DeepSeek R1 70B (Groq)",
      provider: "groq",
      speed: "🧠 350 tok/s (~2-4s)",
      badge: "Fast Reasoning",
      color: "#3b82f6",
      icon: "🧠",
      context: "128K",
      description: "100% Free on Groq. Deep reasoning model with step-by-step thinking in 2-4 seconds instead of 2 minutes."
    },
    {
      id: "gemma2-9b-it",
      name: "Gemma 2 9B (Groq)",
      provider: "groq",
      speed: "⚡ 650 tok/s (~0.3s)",
      badge: "Google Gemma",
      color: "#06b6d4",
      icon: "✨",
      context: "8K",
      description: "100% Free on Groq. Google's efficient, precise instruction model."
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B (Groq)",
      provider: "groq",
      speed: "🌪️ 450 tok/s (~0.4s)",
      badge: "MoE 32K",
      color: "#ec4899",
      icon: "🌪️",
      context: "32K",
      description: "100% Free on Groq. Mistral's mixture-of-experts model for versatile instruction following."
    }
  ],
  gemini: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash (Google)",
      provider: "gemini",
      speed: "⚡ Sub-second (~0.7s)",
      badge: "1M Context",
      color: "#10b981",
      icon: "⚡",
      context: "1M",
      description: "100% Free at Google AI Studio (1,500 req/day). Sub-second response time with giant 1M context."
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash (Google)",
      provider: "gemini",
      speed: "⚡ Sub-second (~0.8s)",
      badge: "Stable 1M",
      color: "#06b6d4",
      icon: "✨",
      context: "1M",
      description: "100% Free at Google AI Studio. Fast multimodal assistant with reliable performance."
    }
  ],
  cerebras: [
    {
      id: "llama3.3-70b",
      name: "Llama 3.3 70B (Cerebras)",
      provider: "cerebras",
      speed: "⚡ 1800 tok/s (~0.2s)",
      badge: "Awesome Free API",
      color: "#8b5cf6",
      icon: "⚡",
      context: "128K",
      description: "100% Free tier from Cerebras Cloud. World-record 1800+ tokens/sec inference speed."
    },
    {
      id: "llama3.1-8b",
      name: "Llama 3.1 8B (Cerebras)",
      provider: "cerebras",
      speed: "⚡ 2100 tok/s (Real-time)",
      badge: "Awesome Free API",
      color: "#14b8a6",
      icon: "🚀",
      context: "128K",
      description: "100% Free tier from Cerebras Cloud. Super-fast lightweight inference."
    }
  ],
  local: [
    {
      id: "ollama/llama3",
      name: "Ollama Llama 3 (Odysseus)",
      provider: "local",
      speed: "💻 Local Hardware",
      badge: "100% Offline",
      color: "#64748b",
      icon: "💻",
      context: "Local",
      description: "100% Free & Offline. Runs on your own PC via Ollama (Odysseus style) with zero keys."
    },
    {
      id: "ollama/deepseek-r1",
      name: "Ollama DeepSeek R1 (Odysseus)",
      provider: "local",
      speed: "💻 Local Hardware",
      badge: "100% Offline",
      color: "#3b82f6",
      icon: "🧠",
      context: "Local",
      description: "100% Free & Offline. Run DeepSeek R1 locally on your machine with total privacy."
    }
  ]
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Combined curated list of 100% strictly free models
  const allModels = [
    ...FREE_MODELS_BY_PROVIDER.groq,
    ...FREE_MODELS_BY_PROVIDER.gemini,
    ...FREE_MODELS_BY_PROVIDER.cerebras,
    ...FREE_MODELS_BY_PROVIDER.local
  ];

  return res.status(200).json({
    success: true,
    hasServerKey: Boolean(
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.CEREBRAS_API_KEY
    ),
    defaultModel: "llama-3.3-70b-versatile",
    providers: [
      {
        id: "groq",
        name: "Groq (Recommended - 100% Free & Fastest)",
        keyPrefix: "gsk_",
        keyUrl: "https://console.groq.com/keys",
        description: "Zero cost, no credit card required, 14,400 requests/day, 500 tokens/sec!"
      },
      {
        id: "gemini",
        name: "Google AI Studio (100% Free)",
        keyPrefix: "AIza",
        keyUrl: "https://aistudio.google.com/apikey",
        description: "Zero cost, no credit card required, 1,500 requests/day, 1M context!"
      },
      {
        id: "cerebras",
        name: "Cerebras Cloud (Awesome Free API)",
        keyPrefix: "csk-",
        keyUrl: "https://cloud.cerebras.ai",
        description: "World's fastest inference (1800+ tok/s), 100% free tier, zero card."
      },
      {
        id: "local",
        name: "Local Ollama / Odysseus (100% Offline)",
        keyPrefix: "local",
        keyUrl: "https://ollama.com",
        description: "Zero API keys needed, 100% private, runs entirely on your local PC."
      }
    ],
    models: allModels
  });
}
