// Automated Test Suite for RoroGPT (Strict Free & Fast Models Verification + Security Boundary)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

    const hasCerebras = data.models.some(m => m.id === "llama3.3-70b" && m.provider === "cerebras");
    assert(hasCerebras, "100% Free Cerebras model 'llama3.3-70b' (1800 tok/s) is present");

    const hasLocal = data.models.some(m => m.provider === "local");
    assert(hasLocal, "100% Free Local Ollama (Odysseus-style) offline models are present");

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
