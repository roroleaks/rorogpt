import { handleCors } from "./_security.js";

// ==========================================================
// FREE-ONLY AI PROVIDER CONFIGURATION & MODEL CATALOG
// Strictly enforces zero payment, zero credit card, zero paid credits.
// Supported: Groq, Google Gemini, Cerebras Cloud, and Local Ollama.
// OpenRouter is completely removed.
// ==========================================================

export const SUPPORTED_PROVIDERS = ["groq", "gemini", "cerebras", "ollama"];

export const PROVIDER_CONFIGS = {
  groq: {
    id: "groq",
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    keyPrefix: "gsk_",
    envKeyName: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    requiresKey: true,
    freeTierNotice: "Available on Groq's developer free tier where eligible. Quotas, rate limits, and model access are subject to Groq terms."
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyPrefix: "AIza",
    envKeyName: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    requiresKey: true,
    freeTierNotice: "Available on Google AI Studio's free tier where eligible (subject to regional availability and quota policies)."
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras Cloud",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    keyPrefix: "csk-",
    envKeyName: "CEREBRAS_API_KEY",
    keyUrl: "https://cloud.cerebras.ai",
    requiresKey: true,
    freeTierNotice: "Available on Cerebras Cloud free tier where eligible. Rate limits and terms are governed by Cerebras."
  },
  ollama: {
    id: "ollama",
    name: "Local Ollama",
    get endpoint() {
      const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
      return `${base}/v1/chat/completions`;
    },
    keyPrefix: "",
    envKeyName: null,
    keyUrl: "https://ollama.com",
    requiresKey: false,
    freeTierNotice: "Runs locally on your computer with zero API keys and zero cloud data sharing. Requires Ollama installed locally."
  }
};

export const FREE_MODELS_BY_PROVIDER = {
  groq: [
    {
      id: "qwen/qwen3.8-27b",
      name: "Qwen 3.8 27B (Groq)",
      provider: "groq",
      speed: "⚡ Ultra-Fast (~0.2s)",
      badge: "Fast & Capable",
      color: "#10b981",
      icon: "🚀",
      context: "131K",
      supportsVision: false,
      description: "Alibaba's 27B model on Groq LPUs. Available on Groq's developer free tier where eligible. Quotas and availability subject to Groq terms.",
      infoUrl: "https://console.groq.com/keys"
    },
    {
      id: "openai/gpt-oss-120b",
      name: "GPT OSS 120B (Groq)",
      provider: "groq",
      speed: "🧠 Deep Reasoning (~0.4s)",
      badge: "Flagship 120B",
      color: "#f59e0b",
      icon: "⚡",
      context: "131K",
      supportsVision: false,
      description: "120B reasoning model with 131K context. Available on Groq's developer free tier where eligible.",
      infoUrl: "https://console.groq.com/keys"
    },
    {
      id: "openai/gpt-oss-20b",
      name: "GPT OSS 20B (Groq)",
      provider: "groq",
      speed: "⚡ Instant (~0.2s)",
      badge: "Instant 20B",
      color: "#3b82f6",
      icon: "⚡",
      context: "131K",
      supportsVision: false,
      description: "Fast 20B model for coding and concise answers. Available on Groq's developer free tier where eligible.",
      infoUrl: "https://console.groq.com/keys"
    },
    {
      id: "allam-2-7b",
      name: "ALLaM 2 7B (Groq)",
      provider: "groq",
      speed: "⚡ Fast (~0.2s)",
      badge: "Multilingual",
      color: "#06b6d4",
      icon: "✨",
      context: "4K",
      supportsVision: false,
      description: "Multilingual instruction model with Arabic & English fluency. Available on Groq's developer free tier where eligible.",
      infoUrl: "https://console.groq.com/keys"
    },
    {
      id: "llama-3.2-11b-vision-preview",
      name: "Llama 3.2 11B Vision (Groq)",
      provider: "groq",
      speed: "👁️ Vision (~0.3s)",
      badge: "Vision AI",
      color: "#ec4899",
      icon: "🖼️",
      context: "128K",
      supportsVision: true,
      description: "Meta's multimodal vision model for inspecting images and charts. Available on Groq's developer free tier where eligible.",
      infoUrl: "https://console.groq.com/keys"
    }
  ],
  gemini: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash (Google)",
      provider: "gemini",
      speed: "⚡ Sub-second (~0.7s)",
      badge: "★ Best & 1M Context",
      color: "#10b981",
      icon: "⚡",
      context: "1M",
      supportsVision: true,
      description: "Google's next-gen multimodal model with 1M context. Available on Google AI Studio's free tier where eligible (subject to regional quotas).",
      infoUrl: "https://aistudio.google.com/apikey"
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
      description: "Fast multimodal assistant with large context. Available on Google AI Studio's free tier where eligible.",
      infoUrl: "https://aistudio.google.com/apikey"
    }
  ],
  cerebras: [
    {
      id: "llama3.3-70b",
      name: "Llama 3.3 70B (Cerebras)",
      provider: "cerebras",
      speed: "⚡ 1800+ tok/s (~0.2s)",
      badge: "Ultra-Fast 70B",
      color: "#8b5cf6",
      icon: "⚡",
      context: "128K",
      supportsVision: false,
      description: "Meta Llama 3.3 70B running on Cerebras CS-3. Available on Cerebras Cloud free tier where eligible.",
      infoUrl: "https://cloud.cerebras.ai"
    },
    {
      id: "llama3.1-8b",
      name: "Llama 3.1 8B (Cerebras)",
      provider: "cerebras",
      speed: "🚀 2100+ tok/s (Real-time)",
      badge: "Fast 8B",
      color: "#14b8a6",
      icon: "🚀",
      context: "128K",
      supportsVision: false,
      description: "Lightweight Llama 3.1 8B on Cerebras CS-3. Available on Cerebras Cloud free tier where eligible.",
      infoUrl: "https://cloud.cerebras.ai"
    },
    {
      id: "llama3.1-70b",
      name: "Llama 3.1 70B (Cerebras)",
      provider: "cerebras",
      speed: "⚡ 1800+ tok/s (~0.2s)",
      badge: "Fast 70B",
      color: "#8b5cf6",
      icon: "⚡",
      context: "128K",
      supportsVision: false,
      description: "Meta Llama 3.1 70B on Cerebras CS-3. Available on Cerebras Cloud free tier where eligible.",
      infoUrl: "https://cloud.cerebras.ai"
    }
  ],
  ollama: [
    {
      id: "ollama/llama3",
      name: "Ollama Llama 3 (Local)",
      provider: "ollama",
      speed: "💻 Local Hardware",
      badge: "100% Offline",
      color: "#64748b",
      icon: "💻",
      context: "Local",
      supportsVision: false,
      description: "Runs locally and privately on your computer via Ollama with zero API keys. Requires model installed locally (ollama run llama3).",
      infoUrl: "https://ollama.com"
    },
    {
      id: "ollama/deepseek-r1",
      name: "Ollama DeepSeek R1 (Local)",
      provider: "ollama",
      speed: "💻 Local Hardware",
      badge: "Local Reasoning",
      color: "#3b82f6",
      icon: "🧠",
      context: "Local",
      supportsVision: false,
      description: "Runs DeepSeek R1 locally on your machine with total privacy. Requires model installed locally (ollama run deepseek-r1).",
      infoUrl: "https://ollama.com"
    }
  ]
};

export const ALL_MODELS = [
  ...FREE_MODELS_BY_PROVIDER.groq,
  ...FREE_MODELS_BY_PROVIDER.gemini,
  ...FREE_MODELS_BY_PROVIDER.cerebras,
  ...FREE_MODELS_BY_PROVIDER.ollama
];

export function getModelById(modelId) {
  if (!modelId || typeof modelId !== "string") return null;
  const trimmed = modelId.trim();

  // Exact match from curated catalog
  const exact = ALL_MODELS.find(m => m.id === trimmed);
  if (exact) return exact;

  // Cerebras prefix alias (e.g. cerebras/llama3.3-70b -> llama3.3-70b)
  if (trimmed.startsWith("cerebras/")) {
    const rawTag = trimmed.replace("cerebras/", "");
    const baseMatch = ALL_MODELS.find(m => m.provider === "cerebras" && m.id === rawTag);
    if (baseMatch) return { ...baseMatch, id: trimmed };
  }

  // Local Ollama dynamic model support (e.g. ollama/mistral or any local model installed by user)
  if (trimmed.startsWith("ollama/")) {
    const rawTag = trimmed.replace("ollama/", "");
    return {
      id: trimmed,
      name: `Ollama (${rawTag})`,
      provider: "ollama",
      speed: "💻 Local Hardware",
      badge: "Local Ollama",
      color: "#64748b",
      icon: "💻",
      context: "Local",
      supportsVision: false,
      description: `Locally running model '${rawTag}' via Ollama with zero API keys.`,
      infoUrl: "https://ollama.com"
    };
  }

  return null;
}

export function getDefaultModel() {
  const envDefault = (process.env.DEFAULT_MODEL || "").trim();
  if (envDefault) {
    const found = ALL_MODELS.find(m => m.id === envDefault);
    if (found) return found.id;
  }
  return "gemini-2.0-flash";
}

export default async function handler(req, res) {
  if (!handleCors(req, res, "GET, OPTIONS")) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const defaultModel = getDefaultModel();

  return res.status(200).json({
    success: true,
    hasServerKey: Boolean(
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.CEREBRAS_API_KEY
    ),
    defaultModel,
    providers: [
      {
        id: "groq",
        name: "Groq (Developer Free Tier)",
        keyPrefix: "gsk_",
        keyUrl: "https://console.groq.com/keys",
        requiresKey: true,
        freeTierNotice: PROVIDER_CONFIGS.groq.freeTierNotice,
        description: "Available on Groq's developer free tier without credit card. Quotas and availability subject to Groq terms."
      },
      {
        id: "gemini",
        name: "Google AI Studio (Free Tier)",
        keyPrefix: "AIza",
        keyUrl: "https://aistudio.google.com/apikey",
        requiresKey: true,
        freeTierNotice: PROVIDER_CONFIGS.gemini.freeTierNotice,
        description: "Available on Google AI Studio's free tier where eligible (subject to regional quota limits)."
      },
      {
        id: "cerebras",
        name: "Cerebras Cloud (Free Tier)",
        keyPrefix: "csk-",
        keyUrl: "https://cloud.cerebras.ai",
        requiresKey: true,
        freeTierNotice: PROVIDER_CONFIGS.cerebras.freeTierNotice,
        description: "Available on Cerebras Cloud free tier where eligible. Rate limits governed by Cerebras."
      },
      {
        id: "ollama",
        name: "Local Ollama (100% Offline & No Key)",
        keyPrefix: "",
        keyUrl: "https://ollama.com",
        requiresKey: false,
        freeTierNotice: PROVIDER_CONFIGS.ollama.freeTierNotice,
        description: "Zero API keys needed, 100% private, runs entirely on your local PC via Ollama."
      }
    ],
    models: ALL_MODELS
  });
}
