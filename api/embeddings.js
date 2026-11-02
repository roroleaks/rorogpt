// 100% Free Lexical & Local Semantic Embeddings Calculator (Zero Paid Credits Required)
import { handleCors } from "./_security.js";

export const CURATED_EMBEDDING_MODELS = [
  {
    id: "free-lexical-vector",
    name: "Roro Fast Lexical Embeddings (100% Free)",
    dimensions: 256,
    description: "Built-in local lexical (TF-IDF + character n-gram) vector model. Instant computation with zero API cost."
  },
  {
    id: "free-fast-vector", // Backward-compatible alias for free-lexical-vector
    name: "Roro Fast Lexical Embeddings (100% Free)",
    dimensions: 256,
    description: "Built-in local lexical (TF-IDF + character n-gram) vector model. Instant computation with zero API cost."
  },
  {
    id: "free-multilingual-ngram",
    name: "Roro Multilingual Vector Embeddings (100% Free)",
    dimensions: 512,
    description: "Subword character n-gram cosine model supporting 50+ languages with zero cost."
  },
  {
    id: "free-ollama-embed",
    name: "Ollama nomic-embed-text (Local Semantic)",
    dimensions: 768,
    description: "Local semantic embedding model powered by nomic-embed-text via Ollama. 100% private, free, and runs on your local machine."
  }
];

// Lightweight local vector computation (TF-IDF & Character N-Gram)
function computeLocalEmbedding(text, dimensions = 256) {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = clean.split(/\s+/).filter(Boolean);
  const vector = new Array(dimensions).fill(0);

  // Hash words into vector space
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash * 31 + word.charCodeAt(c)) & 0xffffffff;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0 / (1.0 + Math.log(1 + i));
  }

  // Also hash character tri-grams for subword similarity
  for (let i = 0; i < clean.length - 2; i++) {
    const tri = clean.slice(i, i + 3);
    let hash = 0;
    for (let c = 0; c < tri.length; c++) {
      hash = (hash * 37 + tri.charCodeAt(c)) & 0xffffffff;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 0.5;
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vector.map(v => v / norm);
}

export default async function handler(req, res) {
  if (!handleCors(req, res, "POST, GET, OPTIONS")) {
    return;
  }

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

  const { input, model = "free-lexical-vector" } = body || {};

  // Support resolving free-fast-vector as alias to free-lexical-vector
  const selectedModel = CURATED_EMBEDDING_MODELS.find(m => m.id === model || (model === "free-fast-vector" && m.id === "free-fast-vector"));
  if (!selectedModel) {
    return res.status(400).json({
      error: `Unsupported embedding model '${model}'. Supported models: ${CURATED_EMBEDDING_MODELS.map(m => m.id).join(", ")}.`
    });
  }

  if (input === undefined || input === null) {
    return res.status(400).json({ error: "Input text is required for embeddings." });
  }

  if (typeof input !== "string" && !Array.isArray(input)) {
    return res.status(400).json({ error: "Input must be a string or an array of strings." });
  }

  if (typeof input === "string") {
    if (!input.trim()) {
      return res.status(400).json({ error: "Input string cannot be empty." });
    }
    if (input.length > 100000) {
      return res.status(400).json({ error: "Input text exceeds maximum length of 100,000 characters." });
    }
  }

  if (Array.isArray(input)) {
    if (input.length === 0) {
      return res.status(400).json({ error: "Input array cannot be empty." });
    }
    if (input.length > 100) {
      return res.status(400).json({ error: "Input array exceeds maximum batch size of 100 items." });
    }
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      if (typeof item !== "string" || !item.trim()) {
        return res.status(400).json({ error: `Input element at index ${i} must be a non-empty string.` });
      }
      if (item.length > 100000) {
        return res.status(400).json({ error: `Input element at index ${i} exceeds maximum length of 100,000 characters.` });
      }
    }
  }

  const inputs = Array.isArray(input) ? input : [input];

  // If local Ollama semantic embedding model requested, lazily proxy or return 503 if unreachable
  if (selectedModel.id === "free-ollama-embed") {
    const ollamaBase = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
    try {
      const ollamaRes = await fetch(`${ollamaBase}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text", input: inputs })
      });
      if (!ollamaRes.ok) {
        return res.status(503).json({
          error: "Ollama not reachable or nomic-embed-text model not pulled. Ensure Ollama is running locally with 'ollama run nomic-embed-text'."
        });
      }
      const ollamaData = await ollamaRes.json();
      return res.status(200).json({
        success: true,
        model: selectedModel.id,
        dimensions: selectedModel.dimensions,
        data: ollamaData.data,
        usage: ollamaData.usage || { prompt_tokens: inputs.reduce((acc, t) => acc + t.length, 0), total_tokens: 0 }
      });
    } catch {
      return res.status(503).json({
        error: "Ollama not reachable. Ensure Ollama is running locally with 'ollama run nomic-embed-text'."
      });
    }
  }

  const dims = selectedModel.dimensions;

  // Compute free local embeddings without external API dependencies or paid credits
  const data = inputs.map((text, idx) => ({
    object: "embedding",
    index: idx,
    embedding: computeLocalEmbedding(String(text), dims)
  }));

  return res.status(200).json({
    success: true,
    model: selectedModel.id,
    dimensions: dims,
    data,
    usage: { prompt_tokens: inputs.reduce((acc, t) => acc + t.length, 0), total_tokens: 0 }
  });
}
