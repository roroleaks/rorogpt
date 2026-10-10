// Automated Test Suite for RoroGPT (Strict Free & Fast Models Verification)
import fs from "node:fs";
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
    "api/chat.js",
    "api/models.js",
    "api/embeddings.js",
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
  console.log("\n--- 3. Strict 100% Free Models Verification ---");
  const baseUrl = "http://localhost:3000";

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
    assert(chatRes.status === 200, "POST /api/chat streams with configured Groq key (HTTP 200 SSE)");
    const contentType = chatRes.headers.get("content-type");
    assert(contentType && contentType.includes("text/event-stream"), "Chat response is text/event-stream (SSE)");
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
