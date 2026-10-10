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

// Parse request body
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
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(raw);
      }
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

  // API Routes
  if (pathname === "/api/chat") {
    req.body = await parseBody(req);
    return chatHandler(req, res);
  }

  if (pathname === "/api/models") {
    req.body = await parseBody(req);
    return modelsHandler(req, res);
  }

  if (pathname === "/api/embeddings") {
    req.body = await parseBody(req);
    return embeddingsHandler(req, res);
  }

  if (pathname === "/api/fetch-url") {
    req.body = await parseBody(req);
    return fetchUrlHandler(req, res);
  }

  // Static files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") {
    safePath = "/index.html";
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path doesn't exist, try appending .html or fallback to index.html
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
