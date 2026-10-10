import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

// Security & Handlers
import { applySecurityHeaders } from "./api/_security.js";
import chatHandler from "./api/chat.js";
import modelsHandler from "./api/models.js";
import embeddingsHandler from "./api/embeddings.js";
import fetchUrlHandler from "./api/fetch-url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

// Mock express/vercel-style response helpers for native http server
function enhanceResponse(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = function (data) {
    res.end(data);
    return res;
  };
  return res;
}

export const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB body limit

// Parse request body safely with size limit
function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch {
        return Promise.resolve(req.body);
      }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    let byteCount = 0;
    req.on("data", chunk => {
      byteCount += chunk.length;
      if (byteCount > MAX_BODY_BYTES) {
        const err = new Error("Payload Too Large: request body exceeds 2 MB limit");
        err.statusCode = 413;
        req.destroy(err);
        reject(err);
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(raw);
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

export async function requestHandler(req, res) {
  enhanceResponse(res);
  applySecurityHeaders(res);

  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const url = new URL(req.url, `${protocol}://${host}`);
  const pathname = url.pathname;

  // Handle body parsing safely for API routes
  if (pathname.startsWith("/api/")) {
    try {
      req.body = await parseBody(req);
    } catch (err) {
      if (err.statusCode === 413) {
        return res.status(413).json({ error: "Payload Too Large: request body exceeds 2 MB limit." });
      }
      return res.status(400).json({ error: "Invalid request payload." });
    }
  }

  // API Routes
  if (pathname === "/api/chat") {
    return chatHandler(req, res);
  }

  if (pathname === "/api/models") {
    return modelsHandler(req, res);
  }

  if (pathname === "/api/embeddings") {
    return embeddingsHandler(req, res);
  }

  if (pathname === "/api/fetch-url") {
    return fetchUrlHandler(req, res);
  }

  // Static files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") {
    safePath = "/index.html";
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path has a file extension and does not exist -> 404 File Not Found
  const rawExt = path.extname(safePath).toLowerCase();
  if (rawExt && !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  // If path doesn't exist, try appending .html or fallback to index.html for SPA routes
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(filePath + ".html")) {
      filePath = filePath + ".html";
    } else {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }
  }

  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
}

const server = http.createServer(requestHandler);

export default requestHandler;
export { server, PORT };

if (!process.env.VERCEL && process.env.AUTORUN_SERVER !== "false") {
  server.listen(PORT, () => {
    console.log("\n========================================================");
    console.log("   🌈 RoroGPT - Colorful Free AI Chat (Vercel Ready)     ");
    console.log("========================================================");
    console.log(`   🚀 Local Server: http://localhost:${PORT}`);
    const hasKey = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.CEREBRAS_API_KEY);
    console.log(`   🔑 API Key:     ${hasKey ? "Free Key Configured in .env ✅" : "Not set (enter in UI Settings) ⚠️"}`);
    console.log("   ☁️  Deploy:      Ready for Vercel deployment");
    console.log("========================================================\n");
  });
}
