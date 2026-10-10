// 100% Free AI Models Provider (Zero Paid Keys, Zero Subscription, Zero Credit Card)
// Supports: Groq (100% Free & World's Fastest), Google Gemini (100% Free), Cerebras (Ultra-Fast), and Local Ollama / Odysseus

export const FREE_MODELS_BY_PROVIDER = {
  groq: [
    {
      id: "qwen/qwen3.8-27b",
      name: "Qwen 3.8 27B (Groq)",
      provider: "groq",
      speed: "⚡ 500 tok/s (~0.2s)",
      badge: "★ Best & Instant",
      color: "#10b981",
      icon: "🚀",
      context: "131K",
      description: "100% Free on Groq. Alibaba's top 27B open model running on ultra-fast Groq LPUs. Lightning-fast responses with zero delay."
    },
    {
      id: "openai/gpt-oss-120b",
      name: "GPT OSS 120B (Groq)",
      provider: "groq",
      speed: "🧠 350 tok/s (~0.4s)",
      badge: "Flagship 120B",
      color: "#f59e0b",
      icon: "⚡",
      context: "131K",
      description: "100% Free on Groq. Massive 120B reasoning model with 131K context window and step-by-step thinking."
    },
    {
      id: "openai/gpt-oss-20b",
      name: "GPT OSS 20B (Groq)",
      provider: "groq",
      speed: "⚡ 700 tok/s (Instant)",
      badge: "Instant 0.2s",
      color: "#3b82f6",
      icon: "⚡",
      context: "131K",
      description: "100% Free on Groq. Ultra-fast 20B model for coding, writing, and instant answers."
    },
    {
      id: "allam-2-7b",
      name: "ALLaM 2 7B (Groq)",
      provider: "groq",
      speed: "⚡ 600 tok/s (~0.2s)",
      badge: "Multilingual",
      color: "#06b6d4",
      icon: "✨",
      context: "4K",
      supportsVision: false,
      description: "100% Free on Groq. Specialized multilingual instruction model with exceptional Arabic & English fluency."
    },
    {
      id: "llama-3.2-11b-vision-preview",
      name: "Llama 3.2 11B Vision (Groq)",
      provider: "groq",
      speed: "👁️ 300 tok/s (~0.3s)",
      badge: "Vision AI",
      color: "#ec4899",
      icon: "🖼️",
      context: "128K",
      supportsVision: true,
      description: "100% Free on Groq. Meta's multimodal vision model capable of inspecting and describing images and charts."
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
      supportsVision: true,
      description: "100% Free at Google AI Studio (1,500 req/day). Sub-second response time with giant 1M context and native multimodal vision."
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
      supportsVision: true,
      description: "100% Free at Google AI Studio. Fast multimodal assistant with reliable performance and image understanding."
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
    defaultModel: "qwen/qwen3.8-27b",
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
