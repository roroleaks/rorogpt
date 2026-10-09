// Vercel Serverless / Node.js Embeddings Endpoint for RoroGPT

export const CURATED_EMBEDDING_MODELS = [
  {
    id: "text-embedding-3-small",
    name: "OpenAI Text Embedding 3 Small",
    dimensions: 1536,
    description: "Fast, accurate and cost-effective embedding model."
  },
  {
    id: "baai/bge-m3",
    name: "BGE M3 (Multilingual)",
    dimensions: 1024,
    description: "Powerful multilingual embeddings supporting 100+ languages."
  },
  {
    id: "nomic-ai/nomic-embed-text-v1.5",
    name: "Nomic Embed Text v1.5",
    dimensions: 768,
    description: "High performance open embedding model with 8k context."
  },
  {
    id: "text-embedding-3-large",
    name: "OpenAI Text Embedding 3 Large",
    dimensions: 3072,
    description: "Highest accuracy embeddings for complex retrieval tasks."
  }
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET: return available embedding models
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      models: CURATED_EMBEDDING_MODELS
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
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
    input,
    model = "text-embedding-3-small",
    apiKey: clientApiKey = ""
  } = body || {};

  const headerKey = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const envKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const finalApiKey = (clientApiKey && clientApiKey.trim()) || headerKey || envKey;

  if (!finalApiKey || !finalApiKey.startsWith("sk-or-")) {
    return res.status(401).json({
      error: "Missing or invalid OpenRouter API Key. Please configure your key in Settings."
    });
  }

  if (!input) {
    return res.status(400).json({ error: "Input text is required for embeddings." });
  }

  try {
    const upstreamRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`,
        "HTTP-Referer": "https://rorogpt.vercel.app",
        "X-Title": "RoroGPT Embeddings"
      },
      body: JSON.stringify({
        model,
        input
      })
    });

    if (!upstreamRes.ok) {
      let errorMsg = `Embeddings error (${upstreamRes.status})`;
      try {
        const errorJson = await upstreamRes.json();
        if (errorJson?.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {
        errorMsg = await upstreamRes.text();
      }
      return res.status(upstreamRes.status).json({ error: errorMsg });
    }

    const data = await upstreamRes.json();
    return res.status(200).json({
      success: true,
      model,
      data: data.data,
      usage: data.usage
    });
  } catch (err) {
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
}
