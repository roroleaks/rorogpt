// Automated Test Suite for RoroGPT (Strict Free & Fast Models Verification + Security Boundary)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("\n========================================================");
  console.log("   🧪 RoroGPT - AUTOMATED TEST SUITE (FREE & FAST)       ");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST SUITE 1: Files existence & logo
  console.log("--- 1. Static Assets & File Integrity ---");
  const files = [
    "public/index.html",
    "public/style.css",
    "public/app.js",
    "public/purify.min.js",
    "public/logo.jpg",
    "public/creator.jpg",
    "public/favicon.svg",
    "api/_security.js",
    "api/chat.js",
    "api/models.js",
    "api/embeddings.js",
    "api/fetch-url.js",
    "package.json",
    "vercel.json",
    "README.md"
  ];

  for (const f of files) {
    const fullPath = path.join(__dirname, f);
    assert(fs.existsSync(fullPath), `File exists: ${f}`);
  }

  // Check logo & creator image sizes are valid
  const logoStat = fs.statSync(path.join(__dirname, "public/logo.jpg"));
  assert(logoStat.size > 10000, `New logo.jpg is present and valid (${logoStat.size} bytes)`);

  const creatorStat = fs.statSync(path.join(__dirname, "public/creator.jpg"));
  assert(creatorStat.size > 10000, `Creator photo creator.jpg is present and valid (${creatorStat.size} bytes)`);

  // TEST SUITE 2: Check UI layout, themes, & creator attribution
  console.log("\n--- 2. UI Layout: Corner Logo, Chat Icon, Dark Themes & Creator Attribution ---");
  const htmlContent = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");
  assert(htmlContent.includes("topbar-corner-logo"), "Corner logo exists in topbar left corner");
  assert(htmlContent.includes("brand-avatar-img"), "Corner logo exists in sidebar brand header (left corner)");
  assert(!htmlContent.includes("welcome-logo-badge"), "Large centered image removed from chat dialog");
  assert(htmlContent.includes("chat-dialog-icon"), "Small icon is used in chat dialog title instead");
  assert(htmlContent.includes("sidebar-creator-attribution") && htmlContent.includes("Dr Raouf Roshdy"), "Sidebar attribution 'Created by Dr Raouf Roshdy' is present");
  assert(htmlContent.includes("creator-sidebar-avatar"), "Creator photo icon is present in sidebar");
  assert(!htmlContent.includes("footer-creator-credit"), "Bottom duplicate creator credit removed (no duplicate)");
  assert(htmlContent.includes("clean-light"), "Clean Daylight light theme is available in menu");
  assert(htmlContent.includes('data-theme="clean-light"'), "Clean Daylight light theme is the default on start");
  assert(htmlContent.includes("emerald-matrix"), "Vibrant dark theme 'Emerald Matrix' is present in menu");
  assert(htmlContent.includes("sidebarBackdrop"), "Mobile sidebar backdrop overlay is present");

  // TEST SUITE 3: HTTP Server & Strict Free Models Validation
  console.log("\n--- 3. HTTP Server & Strict Free Models Verification ---");
  const baseUrl = "http://localhost:3000";
  let spawnedServer = null;

  try {
    await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(800) });
  } catch {
    console.log("  ℹ️ Local server is not currently running. Launching in-process test server on port 3000...");
    process.env.AUTORUN_SERVER = "false";
    const { server } = await import("./server.js");
    await new Promise((resolve, reject) => {
      server.listen(3000, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    spawnedServer = server;
  }

  // Test 3.1: Index HTML
  try {
    const res = await fetch(`${baseUrl}/`);
    assert(res.status === 200, "GET / returns HTTP 200");
  } catch (err) {
    assert(false, `GET / connection failed: ${err.message}`);
  }

  // Test 3.2: /api/models strict free check
  try {
    const res = await fetch(`${baseUrl}/api/models`);
    assert(res.status === 200, "GET /api/models returns HTTP 200");
    const data = await res.json();
    assert(data.success === true, "/api/models returned success: true");

    // Verify Groq, Gemini, Cerebras, Local Ollama models are present
    const hasGroqQwen = data.models.some(m => m.id === "qwen/qwen3.8-27b" && m.provider === "groq");
    assert(hasGroqQwen, "100% Free Groq model 'qwen/qwen3.8-27b' (500 tok/s) is present");

    const hasGroqGptOss = data.models.some(m => m.id === "openai/gpt-oss-120b" && m.provider === "groq");
    assert(hasGroqGptOss, "100% Free Groq flagship model 'openai/gpt-oss-120b' (350 tok/s) is present");

    const hasGemini = data.models.some(m => m.id === "gemini-2.0-flash" && m.provider === "gemini");
    assert(hasGemini, "100% Free Google model 'gemini-2.0-flash' is present");

    const hasCerebras = data.models.some(m => (m.id === "cerebras/llama3.1-70b" || m.id.includes("llama3")) && m.provider === "cerebras");
    assert(hasCerebras, "100% Free Cerebras model 'cerebras/llama3.1-70b' (1800 tok/s) is present");

    const hasLocal = data.models.some(m => m.provider === "ollama" || m.provider === "local");
    assert(hasLocal, "100% Free Local Ollama offline models are present");

    // Ensure NO non-free or paid models exist
    const hasPaid = data.models.some(m => m.price || m.badge?.includes("Paid") || m.id.includes("gpt-4o") || m.id.includes("claude-3-5-sonnet"));
    assert(!hasPaid, "ZERO paid/non-free models in the curated model list");
  } catch (err) {
    assert(false, `GET /api/models failed: ${err.message}`);
  }

  // Test 3.3: /api/embeddings zero-paid-credits check
  try {
    const res = await fetch(`${baseUrl}/api/embeddings`);
    assert(res.status === 200, "GET /api/embeddings returns HTTP 200");
    const data = await res.json();
    assert(data.success === true, "/api/embeddings returned success: true");
    const hasFreeVector = data.models.some(m => m.id === "free-fast-vector");
    assert(hasFreeVector, "100% Free local vector embedding model is active");

    // Test POST embedding computation with zero paid credits
    const postRes = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: ["hello world", "test query"] })
    });
    assert(postRes.status === 200, "POST /api/embeddings calculates vectors with $0 credits");
    const postData = await postRes.json();
    assert(postData.data?.length === 2 && postData.data[0].embedding.length > 0, "Vector embeddings computed successfully");
  } catch (err) {
    assert(false, `GET /api/embeddings failed: ${err.message}`);
  }

  // Test 3.4: /api/chat guard checks
  try {
    const res = await fetch(`${baseUrl}/api/chat`, { method: "GET" });
    assert(res.status === 405, "GET /api/chat returns HTTP 405 Method Not Allowed");

    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "say hello in 2 words" }] })
    });
    const hasKey = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.CEREBRAS_API_KEY);
    if (hasKey && chatRes.status === 200) {
      assert(chatRes.status === 200, "POST /api/chat streams with configured key (HTTP 200 SSE)");
      const contentType = chatRes.headers.get("content-type");
      assert(contentType && contentType.includes("text/event-stream"), "Chat response is text/event-stream (SSE)");
    } else {
      assert(chatRes.status === 200 || chatRes.status === 401, "POST /api/chat method check responds gracefully (HTTP 200 or 401 auth)");
    }
  } catch (err) {
    assert(false, `GET /api/chat method check failed: ${err.message}`);
  }

  // TEST SUITE 4: Universal Attachment & Personal Library Verification
  console.log("\n--- 4. Universal Attachment & Personal Library Verification ---");
  assert(fs.existsSync(path.join(__dirname, "api/fetch-url.js")), "api/fetch-url.js exists");

  // Check client libraries in HTML
  assert(htmlContent.includes("pdf.min.js"), "PDF.js parser included in HTML");
  assert(htmlContent.includes("mammoth.browser.min.js"), "Mammoth DOCX parser included in HTML");
  assert(htmlContent.includes("jszip.min.js"), "JSZip package parser included in HTML");

  // Check Attachment Menu & Controls in HTML
  assert(htmlContent.includes('id="attachMenuBtn"'), "'+' Attachment button present beside composer");
  assert(htmlContent.includes('id="attachMenuPopup"'), "Attachment popup menu present");
  assert(htmlContent.includes('id="actionUploadFiles"'), "Action 1 'Upload files' button present");
  assert(htmlContent.includes('id="actionUploadPhotos"'), "Action 2 'Upload photos' button present");
  assert(htmlContent.includes('id="actionAddSkill"'), "Action 3 'Add a skill' button present");
  assert(htmlContent.includes('id="actionTakePhoto"'), "Action 4 'Take a photo' button present");
  assert(htmlContent.includes('id="actionAddWebLink"'), "Action 5 'Add a website link' button present");
  assert(htmlContent.includes('id="actionOpenLibrary"'), "Personal Library option present in '+' menu");
  assert(htmlContent.includes('id="openLibraryBtn"'), "Personal Library button present in sidebar");
  assert(htmlContent.includes('id="attachmentsTray"'), "Attachments preview tray present in input wrapper");
  assert(htmlContent.includes('id="activeSkillComposerChip"'), "Active skill composer chip present");

  // Check Modals
  assert(htmlContent.includes('id="cameraModal"'), "Live Camera modal present");
  assert(htmlContent.includes('id="webLinkModal"'), "Website link fetcher modal present");
  assert(htmlContent.includes('id="skillModal"'), "Skills management modal present");
  assert(htmlContent.includes('id="libraryModal"'), "Personal Library modal present");
  assert(htmlContent.includes('id="itemPreviewModal"'), "Item preview modal present");

  // TEST SUITE 5: SSRF Protection & Web Link Fetcher Security
  console.log("\n--- 5. SSRF Security & /api/fetch-url Endpoint Verification ---");
  try {
    // 5.1 Rejects missing URL
    const emptyRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(emptyRes.status === 400, "Empty URL returns HTTP 400 Bad Request");

    // 5.2 Rejects Localhost SSRF
    const localRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://localhost:3000/api/models" })
    });
    assert(localRes.status === 403, "SSRF Defense blocks http://localhost (HTTP 403)");

    // 5.3 Rejects 127.0.0.1 Loopback
    const loopRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1:8080/secret" })
    });
    assert(loopRes.status === 403, "SSRF Defense blocks http://127.0.0.1 (HTTP 403)");

    // 5.4 Rejects AWS/Cloud Metadata IP 169.254.169.254
    const metaRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" })
    });
    assert(metaRes.status === 403, "SSRF Defense blocks cloud metadata address 169.254.169.254 (HTTP 403)");

    // 5.5 Rejects Non-HTTP protocols
    const fileRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" })
    });
    assert(fileRes.status === 400 || fileRes.status === 403, "SSRF Defense blocks file:/// protocol");
  } catch (err) {
    assert(false, `/api/fetch-url SSRF security tests failed: ${err.message}`);
  }

  // TEST SUITE 6: Vision Capability Metadata
  console.log("\n--- 6. Vision Multimodal Model Capabilities ---");
  try {
    const res = await fetch(`${baseUrl}/api/models`);
    const data = await res.json();
    const visionModels = data.models.filter(m => m.supportsVision === true);
    assert(visionModels.length >= 2, `Identified ${visionModels.length} vision-capable models (e.g. Gemini 2.0 Flash, Llama 3.2 Vision)`);
    const hasGeminiVision = visionModels.some(m => m.id === "gemini-2.0-flash");
    assert(hasGeminiVision, "gemini-2.0-flash has supportsVision: true");
  } catch (err) {
    assert(false, `Vision model checks failed: ${err.message}`);
  }

  // TEST SUITE 7: Security Access Boundary & Abuse Prevention (Prompt 1)
  console.log("\n--- 7. Security Access Boundary & Abuse Prevention ---");
  const originalEnv = { ...process.env };

  try {
    // 7.1 Security Headers
    const secHeadersRes = await fetch(`${baseUrl}/api/models`);
    assert(secHeadersRes.headers.get("x-content-type-options") === "nosniff", "Safe security header: X-Content-Type-Options: nosniff present");
    assert(secHeadersRes.headers.get("referrer-policy") === "strict-origin-when-cross-origin", "Safe security header: Referrer-Policy present");
    assert(secHeadersRes.headers.get("x-frame-options") === "SAMEORIGIN", "Safe security header: X-Frame-Options: SAMEORIGIN present");
    assert(secHeadersRes.headers.has("permissions-policy"), "Safe security header: Permissions-Policy present");

    // 7.2 Local Development Mode (unauthenticated allowed)
    process.env.NODE_ENV = "development";
    delete process.env.APP_API_TOKEN;
    delete process.env.ALLOWED_ORIGINS;

    const devFetchRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    // In local dev without APP_API_TOKEN, handler executes without auth error (returns 400 for empty body, not 401)
    assert(devFetchRes.status === 400, "Local development mode: request proceeds without token (HTTP 400 Bad Request, not 401)");

    // 7.3 Missing Token in Production
    process.env.NODE_ENV = "production";
    process.env.APP_API_TOKEN = "secret-test-token-777";

    const missingTokenChat = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] })
    });
    assert(missingTokenChat.status === 401, "Production mode: /api/chat rejects missing token (HTTP 401 Unauthorized)");
    const missingTokenChatJson = await missingTokenChat.json();
    assert(missingTokenChatJson.error?.includes("APP_API_TOKEN"), "/api/chat returns consistent JSON error for missing token");

    const missingTokenFetch = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" })
    });
    assert(missingTokenFetch.status === 401, "Production mode: /api/fetch-url rejects missing token (HTTP 401 Unauthorized)");
    const missingTokenFetchJson = await missingTokenFetch.json();
    assert(missingTokenFetchJson.error?.includes("APP_API_TOKEN"), "/api/fetch-url returns consistent JSON error for missing token");

    // 7.4 Valid Token in Production
    const validTokenFetch = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": "secret-test-token-777"
      },
      body: JSON.stringify({})
    });
    assert(validTokenFetch.status === 400, "Production mode: /api/fetch-url accepts valid x-app-token (passes auth boundary to validation)");

    // 7.5 Disallowed Origin Rejection
    process.env.ALLOWED_ORIGINS = "https://trusted-site.example.com,https://rorogpt.uk";
    const disallowedOriginRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://malicious-site.example.com",
        "x-app-token": "secret-test-token-777"
      },
      body: JSON.stringify({})
    });
    assert(disallowedOriginRes.status === 403, "CORS: Cross-origin request from disallowed origin rejected (HTTP 403 Forbidden)");
    const corsDisallowedJson = await disallowedOriginRes.json();
    assert(corsDisallowedJson.error?.includes("CORS"), "Disallowed origin returns consistent JSON error");

    // 7.6 Allowed Origin Acceptance
    const allowedOriginRes = await fetch(`${baseUrl}/api/models`, {
      method: "GET",
      headers: {
        "Origin": "https://rorogpt.uk"
      }
    });
    assert(allowedOriginRes.status === 200, "CORS: Request from allowed origin accepted (HTTP 200)");
    assert(allowedOriginRes.headers.get("access-control-allow-origin") === "https://rorogpt.uk", "CORS: Access-Control-Allow-Origin echoes approved origin");

    // 7.7 Rate-Limit Rejection
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.RATE_LIMIT_MAX_FETCH = "2";
    const testIp = "192.0.2.88";

    // Request 1
    await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": "secret-test-token-777",
        "x-forwarded-for": testIp
      },
      body: JSON.stringify({})
    });

    // Request 2
    await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": "secret-test-token-777",
        "x-forwarded-for": testIp
      },
      body: JSON.stringify({})
    });

    // Request 3 (exceeds limit of 2)
    const rateLimitedRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": "secret-test-token-777",
        "x-forwarded-for": testIp
      },
      body: JSON.stringify({})
    });
    assert(rateLimitedRes.status === 429, "Rate limit: Exceeding request quota returns HTTP 429 Too Many Requests");
    assert(rateLimitedRes.headers.has("retry-after"), "Rate limit: Retry-After header present on 429 response");
    const rateLimitJson = await rateLimitedRes.json();
    assert(rateLimitJson.error?.includes("Rate limit"), "Rate limit: Returns consistent JSON error on 429");
  } catch (err) {
    assert(false, `Security Access Boundary tests failed: ${err.message}`);
  } finally {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }

  // TEST SUITE 8: URL Fetch Streaming Response Size & Timeout Guards (High Fix 2)
  console.log("\n--- 8. URL Fetch Streaming Response Size & Timeout Guards ---");
  let mockServer = null;
  let mockPort = 0;

  try {
    process.env.NODE_ENV = "development";
    delete process.env.APP_API_TOKEN;
    delete process.env.ALLOWED_ORIGINS;

    mockServer = http.createServer((req, res) => {
      res.on("error", () => {});
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === "/small") {
        const body = "<html><head><title>Small Page</title></head><body><h1>Small Article</h1><p>Processed content below limit.</p></body></html>";
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(body)
        });
        res.end(body);
      } else if (url.pathname === "/exact") {
        // Exactly 1,572,864 bytes (1.5 MB)
        const prefix = Buffer.from("<html><head><title>Exact Page</title></head><body><p>");
        const suffix = Buffer.from("</p></body></html>");
        const padLen = 1572864 - prefix.length - suffix.length;
        const pad = Buffer.alloc(padLen, 97); // 'a'
        const exactBuf = Buffer.concat([prefix, pad, suffix]);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": exactBuf.length
        });
        res.end(exactBuf);
      } else if (url.pathname === "/oversized-header") {
        // Content-Length header exceeds 1.5 MB limit
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Content-Length": "2000000"
        });
        res.end("Oversized content");
      } else if (url.pathname === "/chunked-oversized") {
        // Chunked transfer with no Content-Length that exceeds 1.5 MB
        res.writeHead(200, {
          "Content-Type": "text/html"
        });
        const chunk = Buffer.alloc(64 * 1024, 98); // 64 KB
        // Write 26 chunks = ~1.66 MB (> 1.5 MB limit)
        for (let i = 0; i < 26; i++) {
          if (res.destroyed || res.writableEnded) break;
          res.write(chunk);
        }
        if (!res.destroyed && !res.writableEnded) {
          res.end();
        }
      } else if (url.pathname === "/multibyte-oversized") {
        // 600,000 3-byte unicode characters ('世' = 3 bytes in UTF-8)
        // String length is 600,000 (< 1.5M chars), but byte length is 1,800,000 (> 1.5 MB limit)
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8"
        });
        const chunk = Buffer.from("世".repeat(20000)); // 60,000 bytes per chunk
        // 30 chunks = 1,800,000 bytes
        for (let i = 0; i < 30; i++) {
          if (res.destroyed || res.writableEnded) break;
          res.write(chunk);
        }
        if (!res.destroyed && !res.writableEnded) {
          res.end();
        }
      } else if (url.pathname === "/slow-hanging") {
        // Headers sent, but body intentionally hangs to test timeout
        res.writeHead(200, {
          "Content-Type": "text/html"
        });
        // Intentionally do not call res.end()
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    await new Promise((resolve) => {
      mockServer.listen(0, "127.0.0.1", () => {
        mockPort = mockServer.address().port;
        resolve();
      });
    });

    // Enable loopback strictly for mock server testing
    process.env.ALLOW_LOOPBACK_FOR_TESTS = "true";

    // 8.1 Small body below limit succeeds with extracted content
    const smallRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.101" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/small` })
    });
    assert(smallRes.status === 200, "Streaming size limit: Small response well below limit returns HTTP 200");
    const smallJson = await smallRes.json();
    assert(smallJson.title === "Small Page" && smallJson.content.includes("Processed content"), "Streaming size limit: Small response content is successfully parsed");

    // 8.2 Exactly at byte limit (1,572,864 bytes) succeeds
    const exactRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.102" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/exact` })
    });
    assert(exactRes.status === 200, "Streaming size limit: Response exactly at 1.5 MB limit (1,572,864 bytes) succeeds (HTTP 200)");
    const exactJson = await exactRes.json();
    assert(exactJson.success === true && exactJson.charCount > 0, "Streaming size limit: Exact limit response body is extracted");

    // 8.3 Content-Length header exceeding limit rejected before reading body
    const headerOversizedRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.103" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/oversized-header` })
    });
    assert(headerOversizedRes.status === 413, "Streaming size limit: Content-Length > 1.5 MB rejected before reading body (HTTP 413)");
    const headerJson = await headerOversizedRes.json();
    assert(headerJson.error?.includes("maximum allowed size of 1.5 MB"), "Streaming size limit: Returns clear 413 error on oversized Content-Length");

    // 8.4 Chunked response without Content-Length exceeding limit is rejected while streaming
    const chunkedOversizedRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.104" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/chunked-oversized` })
    });
    assert(chunkedOversizedRes.status === 413, "Streaming size limit: Chunked response exceeding 1.5 MB stopped immediately while streaming (HTTP 413)");
    const chunkedJson = await chunkedOversizedRes.json();
    assert(chunkedJson.error?.includes("streaming"), "Streaming size limit: Returns 413 error indicating stream threshold crossed");

    // 8.5 Multibyte UTF-8 characters rejected based on byte count rather than character count
    const multibyteRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.105" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/multibyte-oversized` })
    });
    assert(multibyteRes.status === 413, "Streaming size limit: Multibyte UTF-8 exceeding byte limit is rejected based on bytes, not characters (HTTP 413)");

    // 8.6 Timeout trips and cleans up timer
    process.env.FETCH_TIMEOUT_MS = "200";
    const timeoutRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.106" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/slow-hanging` })
    });
    assert(timeoutRes.status === 504, "Streaming size limit: Hanging response trips timeout cleanly (HTTP 504 Gateway Timeout)");
    delete process.env.FETCH_TIMEOUT_MS;

    // 8.7 Subsequent request succeeds (no hung state, leaked handles, or corrupted streams)
    const healthyRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.107" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/small` })
    });
    assert(healthyRes.status === 200, "Streaming size limit: Subsequent request succeeds after aborted/oversized requests (HTTP 200)");

    // 8.8 SSRF protection: loopback blocked when test flag is absent
    delete process.env.ALLOW_LOOPBACK_FOR_TESTS;
    const ssrfRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.108" },
      body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}/small` })
    });
    assert(ssrfRes.status === 403, "Streaming size limit: SSRF safeguard rejects loopback addresses by default (HTTP 403)");
    const ssrfJson = await ssrfRes.json();
    assert(ssrfJson.isSSRFBlocked === true, "Streaming size limit: SSRF blocked flag confirmed");

  } catch (err) {
    assert(false, `URL Fetch Streaming tests failed: ${err.message}`);
  } finally {
    delete process.env.ALLOW_LOOPBACK_FOR_TESTS;
    delete process.env.FETCH_TIMEOUT_MS;
    if (mockServer) {
      if (typeof mockServer.closeAllConnections === "function") {
        mockServer.closeAllConnections();
      }
      await new Promise((resolve) => mockServer.close(resolve));
    }
  }

  // TEST SUITE 9: Redirect & DNS-Rebinding SSRF Hardening (High Fix 3)
  console.log("\n--- 9. Redirect & DNS-Rebinding SSRF Hardening (High Fix 3) ---");
  let redirectMockServer = null;
  let rPort = 0;
  let privateCanaryHits = 0;

  try {
    process.env.NODE_ENV = "development";
    delete process.env.APP_API_TOKEN;
    delete process.env.ALLOWED_ORIGINS;

    redirectMockServer = http.createServer((req, res) => {
      res.on("error", () => {});
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === "/canary-private") {
        privateCanaryHits++;
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("CONFIDENTIAL_INTERNAL_DATA");
      }

      if (url.pathname === "/public-ok") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<html><head><title>Public Page</title></head><body><h1>Direct Public Content</h1></body></html>");
      }

      if (url.pathname === "/redirect-to-127") {
        res.writeHead(302, { Location: `http://127.0.0.1:${rPort}/canary-private` });
        return res.end();
      }

      if (url.pathname === "/redirect-to-localhost") {
        res.writeHead(302, { Location: `http://localhost:${rPort}/canary-private` });
        return res.end();
      }

      if (url.pathname === "/redirect-to-metadata") {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
        return res.end();
      }

      if (url.pathname === "/redirect-to-private-ip-10") {
        res.writeHead(302, { Location: "http://10.0.0.1/admin" });
        return res.end();
      }

      if (url.pathname === "/redirect-to-private-ip-172") {
        res.writeHead(302, { Location: "http://172.16.0.1/internal" });
        return res.end();
      }

      if (url.pathname === "/redirect-to-private-ip-192") {
        res.writeHead(302, { Location: "http://192.168.1.1/router" });
        return res.end();
      }

      if (url.pathname === "/redirect-to-ipv6-loopback") {
        res.writeHead(302, { Location: "http://[::1]/internal" });
        return res.end();
      }

      if (url.pathname === "/redirect-to-ipv4-mapped") {
        res.writeHead(302, { Location: "http://[::ffff:127.0.0.1]/internal" });
        return res.end();
      }

      if (url.pathname === "/redirect-relative") {
        res.writeHead(302, { Location: "/relative-target" });
        return res.end();
      }

      if (url.pathname === "/relative-target") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<html><body><h1>Relative Target Reached</h1></body></html>");
      }

      // Chain of 3 hops (within 5 limit)
      if (url.pathname === "/chain-hop-1") {
        res.writeHead(302, { Location: "/chain-hop-2" });
        return res.end();
      }
      if (url.pathname === "/chain-hop-2") {
        res.writeHead(302, { Location: "/chain-hop-3" });
        return res.end();
      }
      if (url.pathname === "/chain-hop-3") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<html><body><h1>Chain 3 Final Content</h1></body></html>");
      }

      // Chain of 6 hops (exceeds 5 limit)
      if (url.pathname === "/too-many-start") {
        res.writeHead(302, { Location: "/too-many-1" });
        return res.end();
      }
      if (url.pathname.startsWith("/too-many-")) {
        const step = parseInt(url.pathname.replace("/too-many-", ""), 10);
        res.writeHead(302, { Location: `/too-many-${step + 1}` });
        return res.end();
      }

      // Redirect loop
      if (url.pathname === "/loop-a") {
        res.writeHead(302, { Location: "/loop-b" });
        return res.end();
      }
      if (url.pathname === "/loop-b") {
        res.writeHead(302, { Location: "/loop-a" });
        return res.end();
      }

      // Redirect to file protocol
      if (url.pathname === "/redirect-to-file") {
        res.writeHead(302, { Location: "file:///etc/passwd" });
        return res.end();
      }

      // Redirect to oversized response
      if (url.pathname === "/redirect-to-oversized") {
        res.writeHead(302, { Location: "/oversized-page" });
        return res.end();
      }
      if (url.pathname === "/oversized-page") {
        res.writeHead(200, { "Content-Type": "text/html", "Content-Length": "2000000" });
        return res.end("Oversized content");
      }

      // Redirect to hanging response
      if (url.pathname === "/redirect-to-hanging") {
        res.writeHead(302, { Location: "/hanging-page" });
        return res.end();
      }
      if (url.pathname === "/hanging-page") {
        res.writeHead(200, { "Content-Type": "text/html" });
        // Never ends to trip timeout
        return;
      }

      // DNS rebind target
      if (url.pathname === "/dns-rebind-page") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<h1>Rebind Page</h1>");
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    await new Promise((resolve) => {
      redirectMockServer.listen(0, "127.0.0.1", () => {
        rPort = redirectMockServer.address().port;
        resolve();
      });
    });

    // Enable test loopback for the mock server
    process.env.ALLOW_LOOPBACK_FOR_TESTS = "true";

    // 9.1 Public URL with no redirect succeeds
    const pubRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.110" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/public-ok` })
    });
    assert(pubRes.status === 200, "Redirect hardening: Public URL with no redirect succeeds (HTTP 200)");
    const pubJson = await pubRes.json();
    assert(pubJson.content.includes("Direct Public Content"), "Redirect hardening: Extracted content from direct URL matches");

    // 9.2 Redirect to 127.0.0.1 is blocked before second request
    privateCanaryHits = 0;
    process.env.BLOCK_LOOPBACK_REDIRECTS = "true";
    const redir127Res = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.111" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-127` })
    });
    assert(redir127Res.status === 403, "Redirect hardening: Redirect to 127.0.0.1 is blocked (HTTP 403)");
    const redir127Json = await redir127Res.json();
    assert(redir127Json.isSSRFBlocked === true, "Redirect hardening: isSSRFBlocked confirmed for 127.0.0.1 redirect");
    assert(privateCanaryHits === 0, "Redirect hardening: Canary proves private 127.0.0.1 was NEVER requested");
    delete process.env.BLOCK_LOOPBACK_REDIRECTS;

    // 9.3 Redirect to localhost is blocked
    privateCanaryHits = 0;
    const redirLocalRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.112" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-localhost` })
    });
    assert(redirLocalRes.status === 403, "Redirect hardening: Redirect to localhost is blocked (HTTP 403)");
    const redirLocalJson = await redirLocalRes.json();
    assert(redirLocalJson.isSSRFBlocked === true, "Redirect hardening: isSSRFBlocked confirmed for localhost redirect");
    assert(privateCanaryHits === 0, "Redirect hardening: Canary proves localhost was NEVER requested");

    // 9.4 Redirect to cloud metadata (169.254.169.254) is blocked
    const redirMetaRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.113" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-metadata` })
    });
    assert(redirMetaRes.status === 403, "Redirect hardening: Redirect to 169.254.169.254 is blocked (HTTP 403)");
    const redirMetaJson = await redirMetaRes.json();
    assert(redirMetaJson.isSSRFBlocked === true, "Redirect hardening: isSSRFBlocked confirmed for metadata redirect");

    // 9.5 Redirect to private IPv4 addresses (10.0.0.1, 172.16.0.1, 192.168.1.1) are blocked
    const redir10Res = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.114" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-private-ip-10` })
    });
    assert(redir10Res.status === 403, "Redirect hardening: Redirect to 10.0.0.1 is blocked (HTTP 403)");

    const redir172Res = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.115" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-private-ip-172` })
    });
    assert(redir172Res.status === 403, "Redirect hardening: Redirect to 172.16.0.1 is blocked (HTTP 403)");

    const redir192Res = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.116" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-private-ip-192` })
    });
    assert(redir192Res.status === 403, "Redirect hardening: Redirect to 192.168.1.1 is blocked (HTTP 403)");

    // 9.6 Redirect to private IPv6 and IPv4-mapped IPv6 are blocked
    const redirIpv6Res = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.117" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-ipv6-loopback` })
    });
    assert(redirIpv6Res.status === 403, "Redirect hardening: Redirect to [::1] is blocked (HTTP 403)");

    const redirMappedRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.118" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-ipv4-mapped` })
    });
    assert(redirMappedRes.status === 403, "Redirect hardening: Redirect to [::ffff:127.0.0.1] is blocked (HTTP 403)");

    // 9.7 Relative redirect is resolved and validated correctly
    const redirRelRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.119" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-relative` })
    });
    assert(redirRelRes.status === 200, "Redirect hardening: Relative redirect resolved correctly (HTTP 200)");
    const redirRelJson = await redirRelRes.json();
    assert(redirRelJson.content.includes("Relative Target Reached"), "Redirect hardening: Content from relative redirect target extracted");

    // 9.8 Chain longer than redirect limit (5) is rejected
    const tooManyRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.120" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/too-many-start` })
    });
    assert(tooManyRes.status === 400, "Redirect hardening: Chain exceeding 5 redirects is rejected (HTTP 400)");
    const tooManyJson = await tooManyRes.json();
    assert(tooManyJson.error?.includes("Too many redirects"), "Redirect hardening: Error indicates redirect limit exceeded");

    // 9.9 Redirect loop is detected and rejected
    const loopRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.121" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/loop-a` })
    });
    assert(loopRes.status === 400, "Redirect hardening: Redirect loop detected and rejected (HTTP 400)");
    const loopJson = await loopRes.json();
    assert(loopJson.error?.includes("Redirect loop detected"), "Redirect hardening: Error indicates loop detection");

    // 9.10 Redirect to unsupported protocol (file:) is rejected
    const fileProtoRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.122" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-file` })
    });
    assert(fileProtoRes.status === 400, "Redirect hardening: Redirect to file: protocol is rejected (HTTP 400)");
    const fileProtoJson = await fileProtoRes.json();
    assert(fileProtoJson.error?.includes("unsupported"), "Redirect hardening: Error indicates unsupported protocol");

    // 9.11 Simulated DNS-rebinding case is rejected
    process.env.SIMULATE_DNS_REBINDING = "true";
    const rebindRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.123" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/dns-rebind-page` })
    });
    assert(rebindRes.status === 403, "DNS rebinding: Rebind attempt detected and blocked at socket layer (HTTP 403)");
    const rebindJson = await rebindRes.json();
    assert(rebindJson.isSSRFBlocked === true, "DNS rebinding: isSSRFBlocked confirmed on socket peer check");
    delete process.env.SIMULATE_DNS_REBINDING;

    // 9.12 Normal public redirect chain within limit succeeds
    const chainRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.124" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/chain-hop-1` })
    });
    assert(chainRes.status === 200, "Redirect hardening: Multi-hop redirect chain within limit succeeds (HTTP 200)");
    const chainJson = await chainRes.json();
    assert(chainJson.content.includes("Chain 3 Final Content"), "Redirect hardening: Content after multiple hops correctly fetched");

    // 9.13 Response-size and timeout protections still work with manual redirects
    const redirOversizedRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.125" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-oversized` })
    });
    assert(redirOversizedRes.status === 413, "Redirect hardening: Response size limit enforced after redirect (HTTP 413)");

    process.env.FETCH_TIMEOUT_MS = "200";
    const redirTimeoutRes = await fetch(`${baseUrl}/api/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.126" },
      body: JSON.stringify({ url: `http://127.0.0.1:${rPort}/redirect-to-hanging` })
    });
    assert(redirTimeoutRes.status === 504, "Redirect hardening: Timeout enforced during redirected request (HTTP 504)");
    delete process.env.FETCH_TIMEOUT_MS;

  } catch (err) {
    assert(false, `Redirect & DNS-Rebinding tests failed: ${err.message}`);
  } finally {
    delete process.env.ALLOW_LOOPBACK_FOR_TESTS;
    delete process.env.ALLOW_LOCALHOST_FOR_TESTS;
    delete process.env.BLOCK_LOOPBACK_REDIRECTS;
    delete process.env.SIMULATE_DNS_REBINDING;
    delete process.env.FETCH_TIMEOUT_MS;
    if (redirectMockServer) {
      if (typeof redirectMockServer.closeAllConnections === "function") {
        redirectMockServer.closeAllConnections();
      }
      await new Promise((resolve) => redirectMockServer.close(resolve));
    }
    if (spawnedServer) {
      spawnedServer.close();
    }
  }

  // TEST SUITE 10: Client-Side Markdown Sanitization & Stored XSS Prevention (High Fix 4)
  console.log("\n--- 10. Client-Side Markdown Sanitization & Stored XSS Prevention (High Fix 4) ---");
  try {
    // 10.1 Pinned dependency dompurify in package.json
    const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    const dompurifyVer = pkgJson.dependencies && pkgJson.dependencies.dompurify;
    assert(Boolean(dompurifyVer && /^\d+\.\d+\.\d+$/.test(dompurifyVer)), "High Fix 4: dompurify is pinned to exact version in package.json (no ^ or ~)");

    // 10.2 Pinned dependency jsdom in package.json
    const jsdomVer = pkgJson.dependencies && pkgJson.dependencies.jsdom;
    assert(Boolean(jsdomVer && /^\d+\.\d+\.\d+$/.test(jsdomVer)), "High Fix 4: jsdom is pinned to exact version in package.json (no ^ or ~)");

    // 10.3 Offline / local bundle public/purify.min.js
    const purifyLocalPath = path.join(__dirname, "public", "purify.min.js");
    const purifyStat = fs.existsSync(purifyLocalPath) && fs.statSync(purifyLocalPath);
    assert(Boolean(purifyStat && purifyStat.size > 10000), "High Fix 4: Local public/purify.min.js bundle exists and is >10KB for offline availability");

    // 10.4 public/index.html loads purify.min.js
    const indexHtml = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
    assert(indexHtml.includes('<script src="/purify.min.js"></script>'), "High Fix 4: public/index.html loads local /purify.min.js script");

    // 10.5 public/app.js single escapeHTML and sanitizer pipeline setup
    const appSource = fs.readFileSync(path.join(__dirname, "public", "app.js"), "utf8");
    const escapeMatches = appSource.match(/function\s+escapeHTML\s*\(/g) || [];
    assert(escapeMatches.length === 1, "High Fix 4: public/app.js contains exactly one declaration of escapeHTML");
    assert(appSource.includes("function setupSanitizer"), "High Fix 4: setupSanitizer defined in public/app.js");
    assert(appSource.includes("function sanitizeRenderedHtml"), "High Fix 4: sanitizeRenderedHtml defined in public/app.js");
    assert(appSource.includes("function renderMarkdown"), "High Fix 4: renderMarkdown defined in public/app.js");

    // Setup JSDOM environment for client-side pipeline verification
    const purifyJsCode = fs.readFileSync(purifyLocalPath, "utf8");
    const testDom = new JSDOM("<!DOCTYPE html><html><head></head><body><div id=\"toastContainer\"></div><div id=\"previewModalIcon\"></div><div id=\"previewModalTitle\"></div><div id=\"previewModalBody\"></div><div id=\"chatViewport\"></div><div id=\"messagesContainer\"></div></body></html>", { runScripts: "dangerously" });
    testDom.window.eval(purifyJsCode);

    // Extract sanitizer & markdown pipeline chunk from app.js without DOMContentLoaded initialization
    const sliceStart = appSource.indexOf("function escapeHTML");
    const sliceEnd = appSource.indexOf("THEME HANDLING");
    assert(sliceStart !== -1 && sliceEnd !== -1 && sliceEnd > sliceStart, "High Fix 4: Sanitizer chunk successfully located in app.js");
    testDom.window.eval(appSource.slice(sliceStart, sliceEnd));

    const sanitize = testDom.window.sanitizeRenderedHtml;
    assert(typeof sanitize === "function", "High Fix 4: sanitizeRenderedHtml is callable in DOM environment");

    // 10.6 Dangerous payload 1: <script>alert(1)</script>
    const resScript = sanitize("<script>alert(1)</script>");
    assert(!resScript.toLowerCase().includes("<script") && !resScript.toLowerCase().includes("alert(1)"), "High Fix 4: Payload 1 - <script> tag completely removed");

    // 10.7 Dangerous payload 2: <img src=x onerror=alert(1)>
    const resImgError = sanitize("<img src=x onerror=alert(1)>");
    assert(!resImgError.toLowerCase().includes("onerror") && !resImgError.toLowerCase().includes("alert(1)"), "High Fix 4: Payload 2 - Inline onerror handler completely removed");

    // 10.8 Dangerous payload 3: <a href="javascript:alert(1)">click</a>
    const resJsLink = sanitize('<a href="javascript:alert(1)">click</a>');
    assert(!resJsLink.toLowerCase().includes("javascript:") && !resJsLink.toLowerCase().includes("alert(1)") && !resJsLink.includes('href='), "High Fix 4: Payload 3 - javascript: pseudo-protocol link removed");

    // 10.9 Dangerous payload 4: <iframe src="javascript:alert(1)"></iframe>
    const resIframe = sanitize('<iframe src="javascript:alert(1)"></iframe>');
    assert(!resIframe.toLowerCase().includes("<iframe") && !resIframe.toLowerCase().includes("alert(1)"), "High Fix 4: Payload 4 - <iframe> element completely stripped");

    // 10.10 Dangerous payload 5: <svg onload=alert(1)><circle /></svg>
    const resSvg = sanitize("<svg onload=alert(1)><circle /></svg>");
    assert(!resSvg.toLowerCase().includes("onload") && !resSvg.toLowerCase().includes("alert(1)"), "High Fix 4: Payload 5 - SVG onload attribute stripped");

    // 10.11 Dangerous payload 6: <div style="background:url(javascript:alert(1))">text</div>
    const resCss = sanitize('<div style="background:url(javascript:alert(1))">text</div>');
    assert(!resCss.toLowerCase().includes("url(") && !resCss.toLowerCase().includes("javascript:"), "High Fix 4: Payload 6 - CSS url(javascript:...) injection stripped");

    // 10.12 Dangerous payload 7: <a href="data:text/html,<script>alert(1)</script>">data link</a>
    const resDataLink = sanitize('<a href="data:text/html,<script>alert(1)</script>">data link</a>');
    assert(!resDataLink.toLowerCase().includes("data:") && !resDataLink.toLowerCase().includes("<script") && !resDataLink.includes('href='), "High Fix 4: Payload 7 - data: text/html pseudo-protocol link removed");

    // 10.13 Safe Markdown formatting preserved
    testDom.window.marked = {
      parse: (str) => {
        return str
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
          .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');
      }
    };

    const safeMd = "# Test Heading\n**Bold Text** and *Italic Text*\n- List item 1\n[Safe Link](https://example.com)";
    const renderedSafe = testDom.window.renderMarkdown(safeMd);
    assert(renderedSafe.includes("<h1>Test Heading</h1>"), "High Fix 4: Markdown heading renders properly");
    assert(renderedSafe.includes("<strong>Bold Text</strong>"), "High Fix 4: Markdown bold formatting renders properly");
    assert(renderedSafe.includes("<em>Italic Text</em>"), "High Fix 4: Markdown italic formatting renders properly");
    assert(renderedSafe.includes("<li>List item 1</li>"), "High Fix 4: Markdown list item renders properly");

    // 10.14 Link normalization: https link receives target="_blank" and rel="noopener noreferrer"
    assert(renderedSafe.includes('href="https://example.com"'), "High Fix 4: Safe HTTPS link preserved");
    assert(renderedSafe.includes('target="_blank"'), "High Fix 4: Safe link receives target='_blank'");
    assert(renderedSafe.includes('rel="noopener noreferrer"'), "High Fix 4: Safe link receives rel='noopener noreferrer'");

    // 10.15 Unsafe link schemes (vbscript:, file:) stripped
    const resVbs = sanitize('<a href="vbscript:msgbox(1)">vbs</a>');
    const resFile = sanitize('<a href="file:///C:/Windows/win.ini">file</a>');
    assert(!resVbs.includes('href="vbscript:') && !resFile.includes('href="file:'), "High Fix 4: vbscript: and file: links stripped of href");

    // 10.16 Code block wrapper with copy button
    testDom.window.marked = {
      parse: (str) => '<pre><code class="language-python">print("secure")</code></pre>'
    };
    const codeRendered = testDom.window.renderMarkdown('```python\nprint("secure")\n```');
    assert(codeRendered.includes('class="code-block-wrapper"'), "High Fix 4: Code block is wrapped in .code-block-wrapper");
    assert(codeRendered.includes('class="code-header"'), "High Fix 4: Code block contains header bar");
    assert(codeRendered.includes('class="copy-code-btn"'), "High Fix 4: Code block contains copy button");
    assert(codeRendered.includes('print("secure")'), "High Fix 4: Code block content preserved verbatim");

    // 10.17 KaTeX math formulas intact without introducing XSS
    testDom.window.katex = {
      renderToString: (formula, opts) => {
        return `<span class="katex-math">${testDom.window.escapeHTML(formula)}</span>`;
      }
    };
    testDom.window.marked = { parse: (str) => str };
    const mathRendered = testDom.window.renderMarkdown("Calculate $$E=mc^2$$ and inline $a^2 + b^2 = c^2$ <script>alert(1)</script>");
    assert(mathRendered.includes('class="katex-display"'), "High Fix 4: KaTeX display formula rendered");
    assert(mathRendered.includes('E=mc^2'), "High Fix 4: KaTeX formula content preserved");
    assert(!mathRendered.includes("<script") && !mathRendered.includes("alert(1)"), "High Fix 4: Exploit payload beside math stripped");

    // 10.18 Multi-chunk streaming simulation
    testDom.window.marked = {
      parse: (str) => {
        return str
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      }
    };
    const streamingChunks = [
      "Here is ",
      "some **bold** ",
      "text and <img src=x ",
      "onerror=alert(1)> image ",
      "with [click](javascript:alert(1)) link."
    ];
    let accumulated = "";
    let intermediateExploitDetected = false;
    for (const chunk of streamingChunks) {
      accumulated += chunk;
      const intermediateHtml = testDom.window.renderMarkdown(accumulated);
      if (intermediateHtml.includes("onerror") || intermediateHtml.includes("javascript:") || intermediateHtml.includes("<script")) {
        intermediateExploitDetected = true;
      }
    }
    assert(!intermediateExploitDetected, "High Fix 4: Multi-chunk streaming render never exposes executable markup during streaming");

    // 10.19 Stored XSS defense (simulated message reload from storage)
    const storedMaliciousMsg = {
      id: "msg_stored_999",
      role: "assistant",
      content: "Hello! Here is your result: <img src=x onerror=alert(document.cookie)> and <svg onload=alert(1)>.",
      reasoning: "Step 1: Check <script>alert(1)</script>",
      model: "mistralai/mistral-small-3"
    };
    const renderedStoredContent = testDom.window.renderMarkdown(storedMaliciousMsg.content);
    assert(!renderedStoredContent.includes("onerror"), "High Fix 4: Stored XSS - Stored assistant message has onerror stripped upon render");
    assert(!renderedStoredContent.includes("onload"), "High Fix 4: Stored XSS - Stored assistant message has onload stripped upon render");
    assert(!renderedStoredContent.includes("document.cookie"), "High Fix 4: Stored XSS - Cookie exfiltration payload neutralized");

    // 10.20 Fail-closed fallback: When DOMPurify is unavailable, renders escaped text (NEVER raw HTML)
    const cachedPurify = testDom.window.DOMPurify;
    testDom.window.DOMPurify = null;
    const fallbackSanitized = testDom.window.sanitizeRenderedHtml("<b>Bold</b><script>alert('pwned')</script>");
    assert(fallbackSanitized.includes("&lt;script&gt;alert(&#39;pwned&#39;)&lt;/script&gt;"), "High Fix 4: Fail-closed fallback converts script tags to escaped plain-text entities");
    assert(!fallbackSanitized.includes("<script>"), "High Fix 4: Fail-closed fallback NEVER emits unescaped <script> tag");
    testDom.window.DOMPurify = cachedPurify;

  } catch (err) {
    assert(false, `Test Suite 10 failed with error: ${err.message}\n${err.stack}`);
  }

  // TEST SUITE 11: Removal of Unsafe innerHTML Interpolation Across Client (High Fix 5)
  console.log("\n--- 11. Removal of Unsafe innerHTML Interpolation Across Client (High Fix 5) ---");
  try {
    const appSource = fs.readFileSync(path.join(__dirname, "public", "app.js"), "utf8");
    const indexHtml = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

    // 11.1 Client source code audit: No unapproved innerHTML assignments
    assert(!indexHtml.includes("innerHTML") && !indexHtml.includes("outerHTML") && !indexHtml.includes("insertAdjacentHTML"), "High Fix 5: public/index.html contains zero innerHTML/outerHTML assignments");

    const innerHtmlMatches = [];
    const lines = appSource.split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("innerHTML")) {
        innerHtmlMatches.push({ lineNum: idx + 1, line: line.trim() });
      }
    });

    const unapprovedMatches = innerHtmlMatches.filter(m => {
      return !m.line.includes("renderMarkdown") &&
             !m.line.includes("tempDiv.innerHTML") &&
             !m.line.includes("DOM.previewModalBody.innerHTML = sanitizeRenderedHtml");
    });
    assert(unapprovedMatches.length === 0, `High Fix 5: Zero unapproved innerHTML assignments in public/app.js (found ${unapprovedMatches.length})`);

    // Setup JSDOM environment for DOM API testing
    const testDom11 = new JSDOM(
      `<!DOCTYPE html><html><head></head><body>
        <div id="toastContainer"></div>
        <div id="previewModalIcon"></div>
        <div id="previewModalTitle"></div>
        <div id="previewModalBody"></div>
        <div id="itemPreviewModal"></div>
        <div id="previewAttachToChatBtn"></div>
        <div id="chatViewport"><div id="messagesContainer"></div></div>
        <div id="welcomeScreen"></div>
        <div id="conversationsList"></div>
        <div id="libraryGridContainer"></div>
        <div id="attachmentsTray"></div>
        <div id="dropdownModelsList"></div>
        <div id="fullModelsGrid"></div>
        <div id="embeddingsGrid"></div>
        <div id="skillsListContainer"></div>
        <div id="cameraErrorBanner"></div>
        <div id="linkFetchStatusBox"></div>
        <div id="modelPillBtn"><span class="best-badge"></span></div>
        <div id="modelPillContainer"></div>
        <div id="activeModelName"></div>
        <div id="activeModelDot"></div>
        <div id="inputModelChip"><span class="chip-name"></span><span class="chip-dot"></span></div>
        <div id="welcomeActiveModel"></div>
        <div id="apiKeyStatusBadge"><span class="status-dot"></span><span class="status-text"></span></div>
        <div id="libraryModal"></div>
        <div id="searchChatsInput"></div>
      </body></html>`,
      { runScripts: "dangerously", url: "https://rorogpt.uk" }
    );

    const purifyLocalPath = path.join(__dirname, "public", "purify.min.js");
    testDom11.window.eval(fs.readFileSync(purifyLocalPath, "utf8"));

    // Expose helpers, state, and DOM inside testDom11
    testDom11.window.eval(`
      var DEFAULT_CHAT_MODEL = window.DEFAULT_CHAT_MODEL = "gemini-2.0-flash";
      var DEFAULT_EMBEDDING_MODEL = window.DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

      var DOM = window.DOM = {
        toastContainer: document.getElementById("toastContainer"),
        previewModalIcon: document.getElementById("previewModalIcon"),
        previewModalTitle: document.getElementById("previewModalTitle"),
        previewModalBody: document.getElementById("previewModalBody"),
        itemPreviewModal: document.getElementById("itemPreviewModal"),
        previewAttachToChatBtn: document.getElementById("previewAttachToChatBtn"),
        chatViewport: document.getElementById("chatViewport"),
        messagesContainer: document.getElementById("messagesContainer"),
        welcomeScreen: document.getElementById("welcomeScreen"),
        conversationsList: document.getElementById("conversationsList"),
        libraryGridContainer: document.getElementById("libraryGridContainer"),
        librarySearchInput: { value: "" },
        attachmentsTray: document.getElementById("attachmentsTray"),
        dropdownModelsList: document.getElementById("dropdownModelsList"),
        fullModelsGrid: document.getElementById("fullModelsGrid"),
        embeddingsGrid: document.getElementById("embeddingsGrid"),
        skillsListContainer: document.getElementById("skillsListContainer"),
        cameraErrorBanner: document.getElementById("cameraErrorBanner"),
        linkFetchStatusBox: document.getElementById("linkFetchStatusBox"),
        modelPillBtn: document.getElementById("modelPillBtn"),
        modelPillContainer: document.getElementById("modelPillContainer"),
        activeModelName: document.getElementById("activeModelName"),
        activeModelDot: document.getElementById("activeModelDot"),
        inputModelChip: document.getElementById("inputModelChip"),
        welcomeActiveModel: document.getElementById("welcomeActiveModel"),
        apiKeyStatusBadge: document.getElementById("apiKeyStatusBadge"),
        libraryModal: document.getElementById("libraryModal"),
        searchChatsInput: document.getElementById("searchChatsInput"),
        chatInput: { value: "", focus: () => {} },
        sendBtn: { disabled: false }
      };

      var state = window.state = {
        activeModel: "free-fast",
        activeEmbeddingModel: "text-embedding-3-small",
        activeLibFilter: "all",
        libraryItems: [],
        attachments: [],
        models: [],
        embeddingModels: [],
        skills: [],
        chats: {},
        currentChatId: null,
        previewPendingItem: null,
        apiKey: "",
        isGenerating: false
      };
    `);

    // Evaluate escaping, security helpers, and markdown sanitizer
    const sliceHelpers = appSource.slice(
      appSource.indexOf("function escapeHTML"),
      appSource.indexOf("THEME HANDLING")
    );
    testDom11.window.eval(sliceHelpers);

    const { normalizeErrorMessage, isSafeUrl, isSafeCssColor, showToast } = testDom11.window;
    assert(typeof normalizeErrorMessage === "function", "High Fix 5: normalizeErrorMessage helper loaded");
    assert(typeof isSafeUrl === "function", "High Fix 5: isSafeUrl helper loaded");
    assert(typeof isSafeCssColor === "function", "High Fix 5: isSafeCssColor helper loaded");

    // 11.2 Error message normalization & secret stripping
    const secretMsg = "Error connecting with Authorization: Bearer sk-ant-secretkey12345 at Object.run (/app/server.js:10:5)";
    const normalizedSecret = normalizeErrorMessage(secretMsg, 200);
    assert(!normalizedSecret.includes("sk-ant-secretkey12345"), "High Fix 5: normalizeErrorMessage strips API token/key");
    assert(!normalizedSecret.includes("at Object.run"), "High Fix 5: normalizeErrorMessage strips V8 stack traces");

    // 11.3 URL validation: isSafeUrl
    assert(isSafeUrl("https://images.unsplash.com/photo-123.jpg"), "High Fix 5: isSafeUrl permits https: URLs");
    assert(isSafeUrl("http://example.com/logo.png"), "High Fix 5: isSafeUrl permits http: URLs");
    assert(isSafeUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", true), "High Fix 5: isSafeUrl permits data:image/ when allowed");
    assert(!isSafeUrl("javascript:alert(1)"), "High Fix 5: isSafeUrl rejects javascript: pseudo-protocol");
    assert(!isSafeUrl("vbscript:alert(1)"), "High Fix 5: isSafeUrl rejects vbscript: pseudo-protocol");
    assert(!isSafeUrl("file:///C:/Windows/system.ini"), "High Fix 5: isSafeUrl rejects file: protocol");
    assert(!isSafeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", true), "High Fix 5: isSafeUrl rejects data:text/html even if data:image allowed");

    // 11.4 CSS color validation: isSafeCssColor
    assert(isSafeCssColor("#10b981"), "High Fix 5: isSafeCssColor accepts hex color #10b981");
    assert(isSafeCssColor("rgb(59, 130, 246)"), "High Fix 5: isSafeCssColor accepts rgb()");
    assert(isSafeCssColor("rgba(59, 130, 246, 0.5)"), "High Fix 5: isSafeCssColor accepts rgba()");
    assert(isSafeCssColor("hsl(217, 91%, 60%)"), "High Fix 5: isSafeCssColor accepts hsl()");
    assert(isSafeCssColor("linear-gradient(135deg, #10b981, #06b6d4)"), "High Fix 5: isSafeCssColor accepts safe linear-gradient");
    assert(isSafeCssColor("cyan"), "High Fix 5: isSafeCssColor accepts safe named color 'cyan'");
    assert(!isSafeCssColor("red; background: url(javascript:alert(1))"), "High Fix 5: isSafeCssColor rejects CSS injection with semicolon and url()");
    assert(!isSafeCssColor("expression(alert(1))"), "High Fix 5: isSafeCssColor rejects CSS expression()");
    assert(!isSafeCssColor("<script>"), "High Fix 5: isSafeCssColor rejects HTML markup in color");

    // Evaluate models and embeddings UI rendering
    const sliceModels = appSource.slice(
      appSource.indexOf("function selectModel("),
      appSource.indexOf("USER PC SPECIAL FOLDER STORAGE")
    );
    testDom11.window.eval("function updateApiKeyBadge() {}\nfunction inferProvider(m) { if (!m) return 'groq'; if (m.startsWith('ollama/')) return 'ollama'; if (m.startsWith('cerebras/')) return 'cerebras'; if (m.startsWith('gemini-')) return 'gemini'; return 'groq'; }\n" + sliceModels + "\nwindow.selectModel = selectModel; window.renderModelsUI = renderModelsUI; window.renderEmbeddingsUI = renderEmbeddingsUI;");

    // Evaluate attachments tray rendering
    const sliceAttachments = appSource.slice(
      appSource.indexOf("function renderAttachmentsTray()"),
      appSource.indexOf("async function handleDocumentFiles(")
    );
    testDom11.window.eval(sliceAttachments + "\nwindow.renderAttachmentsTray = renderAttachmentsTray;");

    // Evaluate skills list rendering
    const sliceSkills = appSource.slice(
      appSource.indexOf("function renderSkillsList()"),
      appSource.indexOf("async function handleSkillFileInput")
    );
    testDom11.window.eval(sliceSkills + "\nwindow.renderSkillsList = renderSkillsList;");

    // Evaluate library grid & preview modal
    const sliceLibrary = appSource.slice(
      appSource.indexOf("function renderLibraryGrid()"),
      appSource.indexOf("async function syncLibraryToPCFolder")
    );
    testDom11.window.eval(sliceLibrary + "\nwindow.renderLibraryGrid = renderLibraryGrid; window.previewLibraryItem = previewLibraryItem; window.openPreviewModal = openPreviewModal;");

    // Evaluate chat messages & reasoning box
    const sliceChat = appSource.slice(
      appSource.indexOf("function createReasoningBoxElement"),
      appSource.indexOf("async function computeSimilarity()")
    );
    testDom11.window.eval(sliceChat + "\nwindow.createReasoningBoxElement = createReasoningBoxElement; window.renderConversationsSidebar = renderConversationsSidebar; window.renderMessages = renderMessages; window.appendMessageElement = appendMessageElement; window.updateReasoningBox = updateReasoningBox;");

    // 11.5 Test Case 1: Toast message with <img src=x onerror=alert(1)>
    testDom11.window.showToast('<img src=x onerror=alert(1)>', 'error');
    const toastEl = testDom11.window.document.querySelector('.toast');
    assert(Boolean(toastEl), "High Fix 5: Case 1 - Toast element is appended to DOM");
    assert(toastEl.querySelector("img") === null, "High Fix 5: Case 1 - No <img> DOM element created inside toast from payload");
    const toastMsgSpan = toastEl.querySelector(".toast-msg");
    assert(toastMsgSpan !== null, "High Fix 5: Case 1 - Toast message span exists");
    assert(toastMsgSpan.textContent.includes("<img src=x onerror=alert(1)>"), "High Fix 5: Case 1 - Payload text preserved safely via textContent without execution");

    // 11.6 Test Case 2: Provider error with <script>alert(1)</script>
    testDom11.window.showToast('Provider API failed: <script>alert(1)</script>', 'error');
    const allToasts = testDom11.window.document.querySelectorAll('.toast');
    const latestToast = allToasts[allToasts.length - 1];
    assert(latestToast.querySelector("script") === null, "High Fix 5: Case 2 - No <script> DOM element created inside toast");
    assert(latestToast.textContent.includes("<script>alert(1)</script>"), "High Fix 5: Case 2 - Script tag text preserved literally in textContent");

    // 11.7 Test Case 3: File name in attachment tray with <img src=x onerror=alert(1)>.txt
    testDom11.window.state.attachments = [{
      id: "att_test_1",
      name: '<img src=x onerror=alert(1)>.txt',
      type: "document",
      meta: "12 KB",
      textContent: "Sample text"
    }];
    testDom11.window.renderAttachmentsTray();
    const attTray = testDom11.window.document.getElementById("attachmentsTray");
    const chip = attTray.querySelector(".attachment-chip");
    assert(Boolean(chip), "High Fix 5: Case 3 - Attachment chip element rendered");
    assert(chip.querySelector("img") === null, "High Fix 5: Case 3 - No <img> DOM element created inside document chip");
    const chipName = chip.querySelector(".chip-name");
    assert(chipName !== null && chipName.textContent === '<img src=x onerror=alert(1)>.txt', "High Fix 5: Case 3 - Malicious file name safely set via textContent");

    // 11.8 Test Case 4: Skill name and description with HTML markup
    testDom11.window.state.skills = [{
      id: "skill_test_1",
      name: '<b onmouseover=alert(1)>Custom Skill</b>',
      description: '<script>alert("xss")</script>',
      instructions: "Do this safely"
    }];
    testDom11.window.renderSkillsList();
    const skillsList = testDom11.window.document.getElementById("skillsListContainer");
    const skillCard = skillsList.querySelector(".skill-card");
    assert(Boolean(skillCard), "High Fix 5: Case 4 - Skill card rendered in DOM");
    assert(skillCard.querySelector("b") === null, "High Fix 5: Case 4 - No <b> DOM element created inside skill card");
    assert(skillCard.querySelector("script") === null, "High Fix 5: Case 4 - No <script> DOM element created inside skill card");
    const skillTitle = skillCard.querySelector(".skill-card-title");
    const skillDesc = skillCard.querySelector(".skill-card-desc");
    assert(skillTitle.textContent === '<b onmouseover=alert(1)>Custom Skill</b>', "High Fix 5: Case 4 - Skill title safely matches textContent");
    assert(skillDesc.textContent === '<script>alert("xss")</script>', "High Fix 5: Case 4 - Skill description safely matches textContent");

    // 11.9 Test Case 5: Custom model ID containing quotes, tags, and CSS-like content
    testDom11.window.state.models = [{
      id: 'custom-model"><script>alert(1)</script>',
      name: 'Custom Model <style>body{color:red}</style>',
      description: 'Description with <a href="javascript:alert(1)">Click</a>',
      badgeColor: 'red; background: url(javascript:alert(1))',
      speed: '⚡ 100 tps',
      color: 'red; background: url(javascript:alert(1))'
    }];
    testDom11.window.renderModelsUI();
    const modelsGrid = testDom11.window.document.getElementById("fullModelsGrid");
    const modelCard = modelsGrid.querySelector(".model-card");
    assert(Boolean(modelCard), "High Fix 5: Case 5 - Model card rendered in DOM");
    assert(modelCard.querySelector("script") === null, "High Fix 5: Case 5 - No <script> element inside model card");
    assert(modelCard.querySelector("style") === null, "High Fix 5: Case 5 - No <style> element inside model card");
    assert(modelCard.querySelector("img") === null, "High Fix 5: Case 5 - No <img> element inside model card");
    const cardTitle = modelCard.querySelector(".card-m-name");
    assert(cardTitle.textContent === 'Custom Model <style>body{color:red}</style>', "High Fix 5: Case 5 - Model name matches textContent");

    // Test selectModel with unsafe CSS color
    testDom11.window.selectModel('custom-model"><script>alert(1)</script>');
    const activeDot = testDom11.window.document.getElementById("activeModelDot");
    assert(activeDot.style.background === "rgb(16, 185, 129)" || activeDot.style.background === "#10b981", "High Fix 5: Case 5 - Unsafe color rejected in selectModel; safe fallback applied");

    // 11.10 Test Case 6: Model description containing malicious links
    const cardDesc = modelCard.querySelector(".card-m-desc");
    assert(cardDesc.querySelector("a") === null, "High Fix 5: Case 6 - No <a> tag created inside model description");
    assert(cardDesc.textContent === 'Description with <a href="javascript:alert(1)">Click</a>', "High Fix 5: Case 6 - Model description set via textContent");

    // 11.11 Test Case 7: Webpage title containing markup
    testDom11.window.state.attachments = [{
      id: "att_web_1",
      name: '<svg onload=alert(1)>Web Link</svg>',
      type: "weblink",
      url: "https://example.com",
      meta: "Web Page",
      textContent: "Web page content"
    }];
    testDom11.window.renderAttachmentsTray();
    const webChip = testDom11.window.document.getElementById("attachmentsTray").querySelector(".attachment-chip");
    assert(webChip.querySelector("svg") !== null, "High Fix 5: Case 7 - Chip contains UI SVG icon");
    const injectedSvg = Array.from(webChip.querySelectorAll("svg")).find(s => s.hasAttribute("onload"));
    assert(!injectedSvg, "High Fix 5: Case 7 - No SVG with onload attribute exists");
    const webChipName = webChip.querySelector(".chip-name");
    assert(webChipName.textContent === '<svg onload=alert(1)>Web Link</svg>', "High Fix 5: Case 7 - Webpage title safely rendered via textContent");

    // 11.12 Test Case 8: Library item summary containing <iframe> payload
    const libItem = {
      id: "lib_1",
      name: 'Safe Document <script>alert(1)</script>',
      type: "document",
      summary: '<iframe src="javascript:alert(1)"></iframe>',
      textContent: 'Body content <img src=x onerror=alert(1)>'
    };
    testDom11.window.previewLibraryItem(libItem);
    const previewBody = testDom11.window.document.getElementById("previewModalBody");
    assert(previewBody.querySelector("iframe") === null, "High Fix 5: Case 8 - No <iframe> DOM element created inside preview modal");
    assert(previewBody.querySelector("script") === null, "High Fix 5: Case 8 - No <script> DOM element created inside preview modal");
    const preNode = previewBody.querySelector("pre");
    assert(preNode !== null, "High Fix 5: Case 8 - Preview renders text content inside <pre> node");
    assert(preNode.textContent === 'Body content <img src=x onerror=alert(1)>', "High Fix 5: Case 8 - Payload in document content rendered strictly as text");

    // 11.13 Test Case 9: Image URL using javascript: or unsafe data:
    const unsafeImgItem = {
      id: "lib_img_unsafe",
      name: "Unsafe Image",
      type: "image",
      previewUrl: "javascript:alert(1)"
    };
    testDom11.window.state.libraryItems = [unsafeImgItem];
    testDom11.window.renderLibraryGrid();
    const libGrid = testDom11.window.document.getElementById("libraryGridContainer");
    const imgCard = libGrid.querySelector(".lib-card");
    assert(imgCard !== null, "High Fix 5: Case 9 - Library image card rendered");
    assert(imgCard.querySelector("img") === null, "High Fix 5: Case 9 - Unsafe javascript: previewUrl rejected; no <img> element created");
    const placeholderIcon = imgCard.querySelector(".lib-card-icon");
    assert(placeholderIcon !== null && placeholderIcon.textContent === "🖼️", "High Fix 5: Case 9 - Safe fallback placeholder icon rendered instead");

    // 11.14 Test Case 10: Safe normal values, user chat rendering, and reasoning box
    const userMsg = {
      role: "user",
      content: "Hello from user <script>alert('user')</script>",
      attachments: [{
        id: "att_normal",
        name: "document.pdf",
        type: "document",
        meta: "150 KB"
      }]
    };
    testDom11.window.appendMessageElement(userMsg, 0);
    const msgRow = testDom11.window.document.querySelector('.message-row[data-index="0"]');
    assert(msgRow !== null, "High Fix 5: Case 10 - User message row appended");
    assert(msgRow.querySelector("script") === null, "High Fix 5: Case 10 - User message does not create <script> tag");
    const bubbleText = msgRow.querySelector(".bubble-text");
    assert(bubbleText.textContent === "Hello from user <script>alert('user')</script>", "High Fix 5: Case 10 - User message rendered strictly via textContent");

    // Reasoning box element test
    const reasoningEl = testDom11.window.createReasoningBoxElement("Thinking step 1 <script>alert(1)</script>");
    assert(reasoningEl.querySelector("script") === null, "High Fix 5: Case 10 - Reasoning box does not create <script> DOM element");
    const reasonContent = reasoningEl.querySelector(".reasoning-content");
    assert(reasonContent.textContent === "Thinking step 1 <script>alert(1)</script>", "High Fix 5: Case 10 - Reasoning content set via textContent");

    // Conversations sidebar test
    testDom11.window.state.chats = {
      "chat_1": {
        id: "chat_1",
        title: "Malicious Chat <img src=x onerror=alert(1)>",
        createdAt: 1000
      }
    };
    testDom11.window.renderConversationsSidebar();
    const chatItem = testDom11.window.document.querySelector(".chat-item");
    assert(chatItem !== null, "High Fix 5: Case 10 - Chat item rendered in sidebar");
    assert(chatItem.querySelector("img") === null, "High Fix 5: Case 10 - No <img> created in sidebar chat item title");
    assert(chatItem.querySelector(".chat-item-title").textContent === "Malicious Chat <img src=x onerror=alert(1)>", "High Fix 5: Case 10 - Chat title strictly rendered via textContent");

  } catch (err) {
    assert(false, `Test Suite 11 failed with error: ${err.message}\n${err.stack}`);
  }

  // TEST SUITE 12: Free-Only Provider Configuration & No-Payment Policy Enforcement (Fix 6)
  console.log("\n--- 12. Free-Only Provider Configuration & No-Payment Policy Enforcement (Fix 6) ---");
  try {
    const { default: chatHandler } = await import("./api/chat.js");
    const { default: modelsHandler, SUPPORTED_PROVIDERS, PROVIDER_CONFIGS, ALL_MODELS } = await import("./api/models.js");

    function createMockReqRes(body = {}, headers = {}, method = "POST") {
      const req = {
        method,
        headers: { "content-type": "application/json", ...headers },
        body,
        on(event, fn) { return this; },
        removeListener(event, fn) { return this; },
        destroy() { return this; }
      };
      let statusCode = 200;
      let responseData = null;
      const resHeaders = {};
      const chunks = [];

      const res = {
        statusCode: 200,
        status(code) {
          statusCode = code;
          this.statusCode = code;
          return this;
        },
        setHeader(name, value) {
          resHeaders[name.toLowerCase()] = value;
          return this;
        },
        getHeader(name) {
          return resHeaders[name.toLowerCase()];
        },
        writeHead(code, head) {
          statusCode = code;
          this.statusCode = code;
          if (head) Object.assign(resHeaders, head);
          return this;
        },
        json(data) {
          responseData = data;
          this.ended = true;
          return this;
        },
        send(data) {
          responseData = data;
          this.ended = true;
          return this;
        },
        write(chunk) {
          chunks.push(chunk);
          return true;
        },
        end(data) {
          if (data) chunks.push(data);
          this.ended = true;
          return this;
        },
        getStatus: () => statusCode,
        getData: () => responseData,
        getChunks: () => chunks.join(""),
        getHeaders: () => resHeaders
      };

      return { req, res };
    }

    // 12.1 Case 1: Active configuration has zero OpenRouter references
    const envExample = fs.readFileSync(path.join(__dirname, ".env.example"), "utf8");
    const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    const indexHtml = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");
    const appJs = fs.readFileSync(path.join(__dirname, "public/app.js"), "utf8");

    assert(!envExample.includes("OPENROUTER"), "Fix 6: Case 1 - .env.example contains zero OpenRouter references");
    assert(!SUPPORTED_PROVIDERS.includes("openrouter"), "Fix 6: Case 1 - SUPPORTED_PROVIDERS does not include openrouter");
    assert(ALL_MODELS.every(m => m.provider !== "openrouter" && !m.id.includes(":free")), "Fix 6: Case 1 - ALL_MODELS contains zero OpenRouter or :free models");
    assert(!JSON.stringify(pkgJson).toLowerCase().includes("openrouter"), "Fix 6: Case 1 - package.json contains zero OpenRouter references");
    assert(!indexHtml.toLowerCase().includes("openrouter"), "Fix 6: Case 1 - public/index.html contains zero OpenRouter references");
    assert(!appJs.includes("Connected to OpenRouter"), "Fix 6: Case 1 - public/app.js contains zero active OpenRouter connection badges");

    // 12.2 Case 2: OPENROUTER_API_KEY is not accepted or documented as supported
    assert(!envExample.includes("OPENROUTER_API_KEY"), "Fix 6: Case 2 - OPENROUTER_API_KEY is not documented in .env.example");
    assert(PROVIDER_CONFIGS.openrouter === undefined, "Fix 6: Case 2 - PROVIDER_CONFIGS.openrouter is undefined");
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    assert(!SUPPORTED_PROVIDERS.includes("openrouter"), "Fix 6: Case 2 - Setting OPENROUTER_API_KEY does not enable openrouter");
    delete process.env.OPENROUTER_API_KEY;

    // 12.3 Case 3: Requests with an OpenRouter key, openrouter provider, or :free model suffix return HTTP 400
    const orKeyReq = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "sk-or-v1-abcdef1234567890",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(orKeyReq.req, orKeyReq.res);
    assert(orKeyReq.res.getStatus() === 400, "Fix 6: Case 3 - Request with sk-or- key returns HTTP 400");
    assert(orKeyReq.res.getData()?.error?.includes("OpenRouter is not supported"), "Fix 6: Case 3 - sk-or- error clearly explains OpenRouter is not supported");

    const orProvReq = createMockReqRes({
      provider: "openrouter",
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(orProvReq.req, orProvReq.res);
    assert(orProvReq.res.getStatus() === 400, "Fix 6: Case 3 - Request with provider='openrouter' returns HTTP 400");

    const freeSuffixReq = createMockReqRes({
      provider: "groq",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(freeSuffixReq.req, freeSuffixReq.res);
    assert(freeSuffixReq.res.getStatus() === 400, "Fix 6: Case 3 - Request with ':free' model suffix returns HTTP 400");

    // Helper to mock global fetch for upstream inspection
    const originalGlobalFetch = globalThis.fetch;

    // 12.4 Case 4: Groq requests route strictly to Groq's official chat completions endpoint
    let capturedGroqCall = null;
    globalThis.fetch = async (url, opts) => {
      capturedGroqCall = { url, opts };
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    };

    const groqReq = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "gsk_testvalidkey1234567",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(groqReq.req, groqReq.res);
    assert(capturedGroqCall !== null, "Fix 6: Case 4 - Groq upstream fetch was initiated");
    assert(capturedGroqCall.url === "https://api.groq.com/openai/v1/chat/completions", "Fix 6: Case 4 - Groq request routes strictly to https://api.groq.com/openai/v1/chat/completions");
    assert(capturedGroqCall.opts.headers.Authorization === "Bearer gsk_testvalidkey1234567", "Fix 6: Case 4 - Groq request sends Authorization: Bearer gsk_...");

    // 12.5 Case 5: Gemini requests route strictly to Google AI Studio's official OpenAI-compatible endpoint
    let capturedGeminiCall = null;
    globalThis.fetch = async (url, opts) => {
      capturedGeminiCall = { url, opts };
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    };

    const geminiReq = createMockReqRes({
      provider: "gemini",
      model: "gemini-2.0-flash",
      apiKey: "AIzaSyTestValidGeminiKey",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(geminiReq.req, geminiReq.res);
    assert(capturedGeminiCall !== null, "Fix 6: Case 5 - Gemini upstream fetch was initiated");
    assert(capturedGeminiCall.url === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "Fix 6: Case 5 - Gemini request routes strictly to Google AI Studio OpenAI endpoint");
    assert(capturedGeminiCall.opts.headers.Authorization === "Bearer AIzaSyTestValidGeminiKey", "Fix 6: Case 5 - Gemini request sends Authorization: Bearer AIza...");

    // 12.6 Case 6: Cerebras requests route strictly to Cerebras's official endpoint
    let capturedCerebrasCall = null;
    globalThis.fetch = async (url, opts) => {
      capturedCerebrasCall = { url, opts };
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    };

    const cerebrasReq = createMockReqRes({
      provider: "cerebras",
      model: "cerebras/llama3.1-70b",
      apiKey: "csk-testvalidcerebraskey",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(cerebrasReq.req, cerebrasReq.res);
    assert(capturedCerebrasCall !== null, "Fix 6: Case 6 - Cerebras upstream fetch was initiated");
    assert(capturedCerebrasCall.url === "https://api.cerebras.ai/v1/chat/completions", "Fix 6: Case 6 - Cerebras request routes strictly to https://api.cerebras.ai/v1/chat/completions");
    assert(capturedCerebrasCall.opts.headers.Authorization === "Bearer csk-testvalidcerebraskey", "Fix 6: Case 6 - Cerebras request sends Authorization: Bearer csk-...");

    // 12.7 Case 7: Local Ollama requests route strictly to local loopback (or configured local host) with zero API keys
    let capturedOllamaCall = null;
    globalThis.fetch = async (url, opts) => {
      capturedOllamaCall = { url, opts };
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    };

    const ollamaReq = createMockReqRes({
      provider: "ollama",
      model: "ollama/llama3.2",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(ollamaReq.req, ollamaReq.res);
    assert(capturedOllamaCall !== null, "Fix 6: Case 7 - Local Ollama upstream fetch was initiated");
    assert(capturedOllamaCall.url === "http://127.0.0.1:11434/v1/chat/completions", "Fix 6: Case 7 - Ollama routes strictly to loopback port 11434");
    assert(!capturedOllamaCall.opts.headers.Authorization, "Fix 6: Case 7 - Ollama sends ZERO Authorization headers");

    // 12.8 Case 8: Groq keys cannot authenticate Gemini or Cerebras requests
    const groqKeyOnGemini = createMockReqRes({
      provider: "gemini",
      model: "gemini-2.0-flash",
      apiKey: "gsk_testkey123456",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(groqKeyOnGemini.req, groqKeyOnGemini.res);
    assert(groqKeyOnGemini.res.getStatus() === 400, "Fix 6: Case 8 - Groq key rejected for Gemini request (HTTP 400)");

    const groqKeyOnCerebras = createMockReqRes({
      provider: "cerebras",
      model: "cerebras/llama3.1-70b",
      apiKey: "gsk_testkey123456",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(groqKeyOnCerebras.req, groqKeyOnCerebras.res);
    assert(groqKeyOnCerebras.res.getStatus() === 400, "Fix 6: Case 8 - Groq key rejected for Cerebras request (HTTP 400)");

    // 12.9 Case 9: Gemini keys cannot authenticate Groq or Cerebras requests
    const geminiKeyOnGroq = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "AIzaSyTestKey12345",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(geminiKeyOnGroq.req, geminiKeyOnGroq.res);
    assert(geminiKeyOnGroq.res.getStatus() === 400, "Fix 6: Case 9 - Gemini key rejected for Groq request (HTTP 400)");

    const geminiKeyOnCerebras = createMockReqRes({
      provider: "cerebras",
      model: "cerebras/llama3.1-70b",
      apiKey: "AIzaSyTestKey12345",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(geminiKeyOnCerebras.req, geminiKeyOnCerebras.res);
    assert(geminiKeyOnCerebras.res.getStatus() === 400, "Fix 6: Case 9 - Gemini key rejected for Cerebras request (HTTP 400)");

    // 12.10 Case 10: Cerebras keys cannot authenticate Groq or Gemini requests
    const cerebrasKeyOnGroq = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "csk-testkey12345",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(cerebrasKeyOnGroq.req, cerebrasKeyOnGroq.res);
    assert(cerebrasKeyOnGroq.res.getStatus() === 400, "Fix 6: Case 10 - Cerebras key rejected for Groq request (HTTP 400)");

    const cerebrasKeyOnGemini = createMockReqRes({
      provider: "gemini",
      model: "gemini-2.0-flash",
      apiKey: "csk-testkey12345",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(cerebrasKeyOnGemini.req, cerebrasKeyOnGemini.res);
    assert(cerebrasKeyOnGemini.res.getStatus() === 400, "Fix 6: Case 10 - Cerebras key rejected for Gemini request (HTTP 400)");

    // 12.11 Case 11: Unknown provider names return HTTP 400
    const unknownProv1 = createMockReqRes({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(unknownProv1.req, unknownProv1.res);
    assert(unknownProv1.res.getStatus() === 400, "Fix 6: Case 11 - Unknown provider 'anthropic' returns HTTP 400");

    const unknownProv2 = createMockReqRes({
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(unknownProv2.req, unknownProv2.res);
    assert(unknownProv2.res.getStatus() === 400, "Fix 6: Case 11 - Unknown provider 'openai' returns HTTP 400");

    // 12.12 Case 12: Valid model name for one provider rejected if sent under a different provider (cross-provider mismatch)
    const mismatch1 = createMockReqRes({
      provider: "groq",
      model: "gemini-2.0-flash",
      apiKey: "gsk_test123",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(mismatch1.req, mismatch1.res);
    assert(mismatch1.res.getStatus() === 400, "Fix 6: Case 12 - Groq provider rejects Gemini model (HTTP 400 mismatch)");

    const mismatch2 = createMockReqRes({
      provider: "cerebras",
      model: "qwen/qwen3.8-27b",
      apiKey: "csk-test123",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(mismatch2.req, mismatch2.res);
    assert(mismatch2.res.getStatus() === 400, "Fix 6: Case 12 - Cerebras provider rejects Groq model (HTTP 400 mismatch)");

    const mismatch3 = createMockReqRes({
      provider: "ollama",
      model: "cerebras/llama3.1-70b",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(mismatch3.req, mismatch3.res);
    assert(mismatch3.res.getStatus() === 400, "Fix 6: Case 12 - Ollama provider rejects Cerebras model (HTTP 400 mismatch)");

    // 12.13 Case 13: Arbitrary customEndpoint values are rejected with HTTP 400
    const customEndReq1 = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "gsk_test123",
      customEndpoint: "https://evil-proxy.com/v1/chat/completions",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(customEndReq1.req, customEndReq1.res);
    assert(customEndReq1.res.getStatus() === 400, "Fix 6: Case 13 - Arbitrary https: customEndpoint rejected with HTTP 400");
    assert(customEndReq1.res.getData()?.error?.toLowerCase().includes("custom endpoint"), "Fix 6: Case 13 - Error explains custom endpoints are not permitted");

    const customEndReq2 = createMockReqRes({
      provider: "ollama",
      model: "ollama/llama3.2",
      customEndpoint: "http://attacker.local:8080",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(customEndReq2.req, customEndReq2.res);
    assert(customEndReq2.res.getStatus() === 400, "Fix 6: Case 13 - Arbitrary http: customEndpoint rejected with HTTP 400");

    // 12.14 Case 14: Upstream 402/billing error returns a clear free-tier explanation and never falls back to a paid service
    let upstreamFetchCount = 0;
    globalThis.fetch = async () => {
      upstreamFetchCount++;
      return new Response(JSON.stringify({ error: { message: "Insufficient credits or payment required" } }), {
        status: 402,
        headers: { "content-type": "application/json" }
      });
    };

    const billingReq = createMockReqRes({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      apiKey: "gsk_test123",
      messages: [{ role: "user", content: "hi" }]
    });
    await chatHandler(billingReq.req, billingReq.res);
    assert(billingReq.res.getStatus() === 402, "Fix 6: Case 14 - Upstream 402 returns HTTP 402 to client");
    assert(upstreamFetchCount === 1, "Fix 6: Case 14 - Exactly ONE upstream fetch attempted; ZERO fallback requests made");
    assert(billingReq.res.getData()?.error?.includes("free tier") || billingReq.res.getData()?.error?.includes("payment"), "Fix 6: Case 14 - Error message clarifies free-tier quota/terms");

    // 12.15 Case 15: GET /api/models returns only approved free providers and qualified free-tier notices
    const modelsMock = createMockReqRes({}, {}, "GET");
    await modelsHandler(modelsMock.req, modelsMock.res);
    assert(modelsMock.res.getStatus() === 200, "Fix 6: Case 15 - GET /api/models returns HTTP 200");
    const catalog = modelsMock.res.getData();
    assert(Array.isArray(catalog?.providers), "Fix 6: Case 15 - providers array returned in /api/models");
    const catalogProviderIds = catalog.providers.map(p => p.id);
    assert(catalogProviderIds.length === 4, "Fix 6: Case 15 - Exactly 4 providers returned");
    assert(["groq", "gemini", "cerebras", "ollama"].every(p => catalogProviderIds.includes(p)), "Fix 6: Case 15 - Approved providers match groq, gemini, cerebras, ollama");
    assert(catalog.providers.every(p => typeof p.freeTierNotice === "string" && p.freeTierNotice.length > 10), "Fix 6: Case 15 - Every provider includes a qualified freeTierNotice");
    assert(catalog.models.every(m => ["groq", "gemini", "cerebras", "ollama"].includes(m.provider)), "Fix 6: Case 15 - Every model belongs strictly to an approved free provider");

    // 12.16 Case 16: Fresh checkout with no API keys configured can load the app and successfully use Local Ollama
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    process.env.NODE_ENV = "development";

    // 1. Verify app frontend assets load for fresh checkout
    const freshHtml = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");
    assert(freshHtml.includes("<!DOCTYPE html>") && freshHtml.includes("RoroGPT"), "Fix 6: Case 16 - Fresh checkout loads app frontend interface");

    // 2. Verify model catalog loads with zero keys
    const freshModelsReq = createMockReqRes({}, {}, "GET");
    await modelsHandler(freshModelsReq.req, freshModelsReq.res);
    assert(freshModelsReq.res.getStatus() === 200, "Fix 6: Case 16 - Fresh checkout loads model catalog without keys (HTTP 200)");
    const freshCatalog = freshModelsReq.res.getData();
    assert(freshCatalog.hasServerKey === false, "Fix 6: Case 16 - hasServerKey is false on fresh checkout");
    assert(freshCatalog.models.some(m => m.provider === "ollama"), "Fix 6: Case 16 - Local Ollama models are available on fresh checkout");

    // 3. Ollama works without keys
    let ollamaZeroKeyCall = null;
    globalThis.fetch = async (url, opts) => {
      ollamaZeroKeyCall = { url, opts };
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    };

    const freshOllamaReq = createMockReqRes({
      provider: "ollama",
      model: "ollama/llama3.2",
      messages: [{ role: "user", content: "Hello offline world" }]
    });
    await chatHandler(freshOllamaReq.req, freshOllamaReq.res);
    assert(ollamaZeroKeyCall !== null, "Fix 6: Case 16 - Local Ollama invoked on fresh checkout without keys");
    assert(ollamaZeroKeyCall.url.includes("127.0.0.1:11434"), "Fix 6: Case 16 - Routed to local Ollama on loopback");
    assert(!ollamaZeroKeyCall.opts.headers.Authorization, "Fix 6: Case 16 - Zero API keys sent or required for Local Ollama");

    // Restore original global fetch
    globalThis.fetch = originalGlobalFetch;

  } catch (err) {
    assert(false, `Test Suite 12 failed with error: ${err.message}\n${err.stack}`);
  }

  // TEST SUITE 13: Binary Attachment IndexedDB Storage & Quota Safety (Fix 7)
  console.log("\n--- 13. Binary Attachment IndexedDB Storage & Quota Safety (Fix 7) ---");
  try {
    const appSource = fs.readFileSync(path.join(__dirname, "public", "app.js"), "utf8");

    // Setup fresh JSDOM environment for Fix 7 testing
    const testDom13 = new JSDOM(
      `<!DOCTYPE html><html><head></head><body>
        <div id="toastContainer"></div>
        <div id="previewModalIcon"></div>
        <div id="previewModalTitle"></div>
        <div id="previewModalBody"></div>
        <div id="itemPreviewModal"></div>
        <div id="previewAttachToChatBtn"></div>
        <div id="chatViewport"><div id="messagesContainer"></div></div>
        <div id="welcomeScreen"></div>
        <div id="conversationsList"></div>
        <div id="libraryGridContainer"></div>
        <div id="attachmentsTray"></div>
        <div id="cleanOrphanBlobsBtn"></div>
        <div id="storageHealthBadge"></div>
        <div id="storageIndicatorDot"></div>
        <div id="storageUsageText"></div>
        <input id="chatInput" value="" />
        <button id="sendBtn"></button>
        <div id="generatingBar"><span class="gen-text"></span></div>
      </body></html>`,
      { runScripts: "dangerously", url: "https://rorogpt.uk" }
    );

    const purifyPath = path.join(__dirname, "public", "purify.min.js");
    testDom13.window.eval(fs.readFileSync(purifyPath, "utf8"));

    // Prepare test context with mock IndexedDB
    testDom13.window.eval(`
      var DOM = window.DOM = {
        toastContainer: document.getElementById("toastContainer"),
        previewModalIcon: document.getElementById("previewModalIcon"),
        previewModalTitle: document.getElementById("previewModalTitle"),
        previewModalBody: document.getElementById("previewModalBody"),
        itemPreviewModal: document.getElementById("itemPreviewModal"),
        previewAttachToChatBtn: document.getElementById("previewAttachToChatBtn"),
        chatViewport: document.getElementById("chatViewport"),
        messagesContainer: document.getElementById("messagesContainer"),
        welcomeScreen: document.getElementById("welcomeScreen"),
        conversationsList: document.getElementById("conversationsList"),
        libraryGridContainer: document.getElementById("libraryGridContainer"),
        librarySearchInput: { value: "" },
        attachmentsTray: document.getElementById("attachmentsTray"),
        cleanOrphanBlobsBtn: document.getElementById("cleanOrphanBlobsBtn"),
        storageHealthBadge: document.getElementById("storageHealthBadge"),
        storageIndicatorDot: document.getElementById("storageIndicatorDot"),
        storageUsageText: document.getElementById("storageUsageText"),
        chatInput: document.getElementById("chatInput"),
        sendBtn: document.getElementById("sendBtn"),
        generatingBar: document.getElementById("generatingBar")
      };

      var sfx = window.sfx = { playPop: () => {}, playReceive: () => {} };

      var state = window.state = {
        activeModel: "gemini-2.0-flash",
        activeProvider: "gemini",
        activeLibFilter: "all",
        libraryItems: [],
        attachments: [],
        models: [{ id: "gemini-2.0-flash", supportsVision: true }],
        skills: [],
        chats: {},
        currentChatId: null,
        storageHealth: "healthy",
        isGenerating: false,
        apiKey: "",
        appToken: ""
      };

      var _idbStores = new Map();
      var _idbUpgraded = false;
      window.indexedDB = {
        open: function(name, version) {
          var req = { result: null, error: null };
          setTimeout(() => {
            var db = {
              objectStoreNames: {
                contains: function(s) { return _idbStores.has(s); }
              },
              createObjectStore: function(s, opts) {
                if (!_idbStores.has(s)) {
                  _idbStores.set(s, new Map());
                }
                return _idbStores.get(s);
              },
              transaction: function(storeName, mode) {
                var m = _idbStores.get(storeName);
                if (!m) {
                  m = new Map();
                  _idbStores.set(storeName, m);
                }
                var tx = {
                  oncomplete: null,
                  onerror: null,
                  objectStore: function(sn) {
                    return {
                      put: function(item) {
                        var key = item.id || Date.now();
                        m.set(key, item);
                      },
                      get: function(key) {
                        var r = { result: m.get(key) || null, onsuccess: null, onerror: null };
                        setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                        return r;
                      },
                      getAll: function() {
                        var r = { result: Array.from(m.values()), onsuccess: null, onerror: null };
                        setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                        return r;
                      },
                      delete: function(key) {
                        m.delete(key);
                      }
                    };
                  }
                };
                setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
                return tx;
              }
            };
            req.result = db;
            if (!_idbUpgraded && req.onupgradeneeded) {
              _idbUpgraded = true;
              req.onupgradeneeded();
            }
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }
      };
    `);

    // Evaluate helpers, IDB functions, and attachment logic from app.js
    const startHelperIdx = appSource.indexOf("function escapeHTML");
    const endStartupIdx = appSource.indexOf("document.addEventListener(\"DOMContentLoaded\"");
    const testCode = appSource.slice(startHelperIdx, endStartupIdx);
    testDom13.window.eval(testCode);

    const win = testDom13.window;

    // 13.1 Schema upgrade: v2 to v3 with attachment_blobs store
    assert(win.IDB_VERSION === 3, "Fix 7: Case 14 - IDB_VERSION is set to 3 for attachment blob storage");
    assert(win.IDB_STORE_BLOBS === "attachment_blobs", "Fix 7: Case 14 - Dedicated IDB store 'attachment_blobs' is configured");

    // 13.2 Case 1: Normal text conversations still persist cleanly across reloads using localStorage
    win.state.chats = {
      chat_text_1: {
        id: "chat_text_1",
        title: "Text Chat",
        createdAt: 1000,
        model: "gemini-2.0-flash",
        messages: [
          { role: "user", content: "Hello RoroGPT" },
          { role: "assistant", content: "Hello! How can I help you today?" }
        ]
      }
    };
    win.state.currentChatId = "chat_text_1";
    win.saveChatsToStorage();

    const storedChatsRaw = win.localStorage.getItem("roro_chats");
    assert(Boolean(storedChatsRaw), "Fix 7: Case 1 - roro_chats is saved to localStorage");
    const parsedChats = JSON.parse(storedChatsRaw);
    assert(parsedChats.chat_text_1.messages.length === 2, "Fix 7: Case 1 - Chat messages persist cleanly in localStorage");
    assert(parsedChats.chat_text_1.messages[0].content === "Hello RoroGPT", "Fix 7: Case 1 - User text message persists");
    assert(parsedChats.chat_text_1.messages[1].content.includes("Hello! How can I help"), "Fix 7: Case 1 - Assistant response persists");

    // Clear and reload
    win.state.chats = {};
    await win.loadSavedChats();
    assert(Boolean(win.state.chats.chat_text_1), "Fix 7: Case 1 - Conversation restored from localStorage on loadSavedChats");

    // 13.3 Case 2: Image attachments store raw binary/blob data outside localStorage
    const sampleBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const blobId = await win.storeAttachmentBlob(sampleBase64, "image/png", "test_blob_1");
    assert(blobId === "test_blob_1", "Fix 7: Case 2 - Attachment blob saved with expected blobId");

    const retrievedBlob = await win.getAttachmentBlob("test_blob_1");
    assert(retrievedBlob !== null && Boolean(retrievedBlob.blob), "Fix 7: Case 2 - Attachment binary retrieved from blob store");
    assert(retrievedBlob.mimeType === "image/png", "Fix 7: Case 2 - Attachment blob preserves mimeType");

    // 13.4 Case 3: localStorage.getItem("roro_chats") contains no base64 image data strings
    win.state.chats.chat_with_img = {
      id: "chat_with_img",
      title: "Image Chat",
      createdAt: 2000,
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: "Look at this picture",
          attachments: [
            {
              id: "att_1",
              type: "image",
              name: "photo.png",
              size: 1024,
              mimeType: "image/png",
              blobId: "test_blob_1",
              meta: "1 KB",
              // Intentionally supply base64Data or previewUrl to ensure prepareChatsForLocalStorage strips it
              base64Data: sampleBase64,
              previewUrl: sampleBase64
            }
          ]
        }
      ]
    };
    win.state.currentChatId = "chat_with_img";
    win.saveChatsToStorage();

    const storedRawWithImg = win.localStorage.getItem("roro_chats");
    assert(!storedRawWithImg.includes(";base64,"), "Fix 7: Case 3 - Zero base64 payload strings stored in roro_chats localStorage");
    assert(!storedRawWithImg.includes("data:image/"), "Fix 7: Case 3 - Zero data:image/ URLs stored in roro_chats localStorage");
    const parsedImgChat = JSON.parse(storedRawWithImg);
    const savedAtt = parsedImgChat.chat_with_img.messages[0].attachments[0];
    assert(savedAtt.blobId === "test_blob_1", "Fix 7: Case 3 - Lightweight metadata with blobId preserved in localStorage");
    assert(savedAtt.base64Data === undefined, "Fix 7: Case 3 - base64Data is completely stripped from localStorage");
    assert(savedAtt.previewUrl === undefined, "Fix 7: Case 3 - previewUrl is completely stripped from localStorage");

    // 13.5 Case 4: Loading an existing chat with image attachments successfully resolves preview from IndexedDB/Object URLs
    win.renderMessages(win.state.chats.chat_with_img.messages);
    const msgContainer = win.document.getElementById("messagesContainer");
    const attachedImg = msgContainer.querySelector(".msg-attached-img");
    assert(attachedImg !== null, "Fix 7: Case 4 - Attached image element rendered in message bubble");
    // Wait microtask for getAttachmentBlob promise resolution
    await new Promise(r => setTimeout(r, 20));
    assert(attachedImg.getAttribute("data-preview") === "true", "Fix 7: Case 4 - Image preview resolution completed with click-to-preview attribute");

    // 13.6 Case 5: Outbound vision request generates temporary base64 payload without persisting to localStorage
    let interceptedChatBody = null;
    const originalFetch = win.fetch;
    win.fetch = async (url, opts) => {
      if (url === "/api/chat") {
        interceptedChatBody = JSON.parse(opts.body);
        return {
          ok: true,
          body: {
            getReader() {
              let sent = false;
              return {
                async read() {
                  if (!sent) {
                    sent = true;
                    return { done: false, value: new TextEncoder().encode('data: {"content":"I see a green square."}\\n\\ndata: [DONE]\\n\\n') };
                  }
                  return { done: true, value: undefined };
                }
              };
            }
          }
        };
      }
      return originalFetch(url, opts);
    };

    win.state.attachments = [
      {
        id: "att_vision_1",
        type: "image",
        name: "test.png",
        size: 512,
        mimeType: "image/png",
        blobId: "test_blob_1"
      }
    ];
    win.DOM.chatInput.value = "Describe this uploaded photo";
    await win.sendMessage();

    assert(interceptedChatBody !== null, "Fix 7: Case 5 - Outbound /api/chat request initiated");
    const outboundUserMsg = interceptedChatBody.messages[interceptedChatBody.messages.length - 1];
    assert(Array.isArray(outboundUserMsg.content), "Fix 7: Case 5 - Outbound message content structured as multimodal array for vision model");
    const imgPart = outboundUserMsg.content.find(p => p.type === "image_url");
    assert(imgPart && imgPart.image_url.url.startsWith("data:image/"), "Fix 7: Case 5 - Temporary data URL constructed for outbound API payload");

    // Verify localStorage has NO base64
    const postSendStorage = win.localStorage.getItem("roro_chats");
    assert(!postSendStorage.includes(";base64,"), "Fix 7: Case 5 - Outbound base64 payload NEVER persisted to localStorage");

    // 13.7 Case 6 & 7: Idempotent legacy migration of chats containing base64 images
    const legacyChats = {
      legacy_chat_1: {
        id: "legacy_chat_1",
        title: "Old Chat with Base64",
        createdAt: 500,
        messages: [
          {
            role: "user",
            content: "Here is an old image",
            attachments: [
              {
                id: "att_old",
                type: "image",
                name: "legacy.png",
                size: 2048,
                mimeType: "image/png",
                base64Data: sampleBase64,
                previewUrl: sampleBase64
              }
            ]
          }
        ]
      }
    };
    win.state.chats = legacyChats;
    const modifiedFirst = await win.migrateLegacyChats();
    assert(modifiedFirst === true, "Fix 7: Case 6 - migrateLegacyChats identifies and migrates legacy base64 attachments");
    const migratedAtt = win.state.chats.legacy_chat_1.messages[0].attachments[0];
    assert(Boolean(migratedAtt.blobId), "Fix 7: Case 6 - Legacy attachment assigned blobId in IndexedDB");
    assert(migratedAtt.base64Data === undefined, "Fix 7: Case 6 - Inline base64Data removed during migration");

    // Verify blob is in store
    const retrievedMigrated = await win.getAttachmentBlob(migratedAtt.blobId);
    assert(retrievedMigrated !== null && Boolean(retrievedMigrated.blob), "Fix 7: Case 6 - Legacy image binary safely stored in blob store");

    // Test Case 7: Second migration is idempotent
    const modifiedSecond = await win.migrateLegacyChats();
    assert(modifiedSecond === false, "Fix 7: Case 7 - migrateLegacyChats is strictly idempotent (no re-migration)");
    assert(win.state.chats.legacy_chat_1.messages[0].attachments[0].blobId === migratedAtt.blobId, "Fix 7: Case 7 - blobId remains stable across migrations");

    // 13.8 Case 8: Missing or corrupt attachment blob renders safe placeholder
    win.state.chats.broken_chat = {
      id: "broken_chat",
      title: "Missing Blob Chat",
      createdAt: 600,
      messages: [
        {
          role: "user",
          content: "Missing photo test",
          attachments: [
            {
              id: "att_missing",
              type: "image",
              name: "deleted_pic.jpg",
              blobId: "non_existent_blob_999",
              meta: "500 KB"
            }
          ]
        }
      ]
    };
    win.renderMessages(win.state.chats.broken_chat.messages);
    await new Promise(r => setTimeout(r, 20));
    const unavailableBadge = win.document.querySelector(".attachment-unavailable");
    assert(unavailableBadge !== null, "Fix 7: Case 8 - Safe placeholder rendered when blob is missing");
    assert(unavailableBadge.textContent.includes("deleted_pic.jpg"), "Fix 7: Case 8 - Placeholder displays original file name");
    assert(unavailableBadge.textContent.includes("Attachment unavailable"), "Fix 7: Case 8 - Placeholder clearly indicates unavailable state");

    // 13.9 Case 9: Simulated QuotaExceededError recovery in saveChatsToStorage()
    let quotaErrorThrown = false;
    const realSetItem = win.Storage.prototype.setItem;
    win.Storage.prototype.setItem = function(key, val) {
      if (key === "roro_chats") {
        quotaErrorThrown = true;
        const err = new Error("QuotaExceededError: DOM Exception 22");
        err.name = "QuotaExceededError";
        throw err;
      }
      return realSetItem.call(this, key, val);
    };

    win.saveChatsToStorage();
    assert(quotaErrorThrown, "Fix 7: Case 9 - QuotaExceededError triggered on setItem");
    assert(win.state.storageHealth === "degraded" || win.state.storageHealth === "unavailable", "Fix 7: Case 9 - Storage health transitions to degraded/unavailable");
    assert(Boolean(win.state.chats.broken_chat), "Fix 7: Case 9 - In-memory conversation state NEVER wiped out on quota error");
    win.Storage.prototype.setItem = realSetItem; // Restore

    // 13.10 Case 10: Document and webpage text limits enforced with truncation notices
    const hugeDocText = "A".repeat(150000);
    const mockDocFile = {
      name: "huge_document.txt",
      size: 150000,
      type: "text/plain",
      text: async () => hugeDocText
    };
    await win.handleDocumentFiles([mockDocFile]);
    const docAtt = win.state.attachments.find(a => a.name === "huge_document.txt");
    assert(Boolean(docAtt), "Fix 7: Case 10 - Document parsed and attached");
    assert(docAtt.textContent.length < 110000, "Fix 7: Case 10 - Document content truncated to limit");
    assert(docAtt.textContent.includes("[...Document truncated"), "Fix 7: Case 10 - Clear truncation message embedded in text");
    assert(docAtt.meta.includes("Truncated"), "Fix 7: Case 10 - Metadata badge includes 'Truncated'");
    win.state.attachments = []; // Clear tray

    // 13.11 Case 11: Personal Library reuses existing blobId without data duplication
    win.state.attachments = [
      {
        id: "att_lib_test",
        type: "image",
        name: "shared_photo.png",
        size: 2048,
        blobId: "test_blob_1",
        meta: "2 KB"
      }
    ];
    await win.saveAttachmentToLibrary("att_lib_test");
    assert(win.state.libraryItems.length > 0, "Fix 7: Case 11 - Item saved to Personal Library");
    const savedLibItem = win.state.libraryItems.find(i => i.name === "shared_photo.png");
    assert(savedLibItem.blobId === "test_blob_1", "Fix 7: Case 11 - Library item references existing blobId");
    assert(savedLibItem.base64Data === undefined, "Fix 7: Case 11 - Library item contains zero base64 payload");

    // Attach library item to chat
    win.state.attachments = [];
    win.attachLibraryItemToChat(savedLibItem);
    const reattached = win.state.attachments[0];
    assert(reattached.blobId === "test_blob_1", "Fix 7: Case 11 - Re-attached item reuses same blobId without duplicating data");
    win.state.attachments = [];

    // 13.12 Case 12: Orphaned image cleanup removes unreferenced blobs safely
    const orphanBlobId = await win.storeAttachmentBlob(sampleBase64, "image/png", "orphan_blob_99");
    assert(Boolean(await win.getAttachmentBlob("orphan_blob_99")), "Fix 7: Case 12 - Orphan blob created in store");

    const cleanupResult = await win.cleanupOrphanedBlobs();
    assert(cleanupResult.cleaned >= 1, "Fix 7: Case 12 - cleanupOrphanedBlobs detected and deleted unreferenced orphan blob");
    assert((await win.getAttachmentBlob("orphan_blob_99")) === null, "Fix 7: Case 12 - Orphan blob removed from storage");
    assert((await win.getAttachmentBlob("test_blob_1")) !== null, "Fix 7: Case 12 - Referenced active blob test_blob_1 preserved");

    // 13.13 Case 13: Auto-save / PC-folder export writes image attachment files properly
    let writtenFiles = {};
    win.state.dirHandle = {
      async queryPermission() { return "granted"; },
      async requestPermission() { return "granted"; },
      async getFileHandle(fileName, opts) {
        return {
          async createWritable() {
            return {
              async write(data) {
                writtenFiles[fileName] = data;
              },
              async close() {}
            };
          }
        };
      }
    };
    const chatToExport = {
      id: "chat_with_img",
      title: "Image Chat",
      createdAt: 2000,
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: "Look at this picture",
          attachments: [
            {
              id: "att_1",
              type: "image",
              name: "photo.png",
              size: 1024,
              mimeType: "image/png",
              blobId: "test_blob_1",
              meta: "1 KB"
            }
          ]
        }
      ]
    };
    await win.autoSaveChatToPC(chatToExport);
    const expectedExportFileName = `chat_with_img_photo.png`;
    assert(Boolean(writtenFiles[expectedExportFileName]), "Fix 7: Case 13 - autoSaveChatToPC exports image attachment binary to PC folder");

    win.fetch = originalFetch; // Restore

  } catch (err) {
    assert(false, `Test Suite 13 failed with error: ${err.message}\n${err.stack}`);
  }

  // Summary
  console.log("\n========================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runTests();
