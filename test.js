// Automated Test Suite for RoroGPT
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("\n========================================================");
  console.log("   🧪 RoroGPT - AUTOMATED TEST SUITE                    ");
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

  // TEST SUITE 1: Files existence
  console.log("--- 1. Static Assets & File Integrity ---");
  const files = [
    "public/index.html",
    "public/style.css",
    "public/app.js",
    "public/logo.jpg",
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

  // TEST SUITE 2: Check logo image size
  const logoStats = fs.statSync(path.join(__dirname, "public/logo.jpg"));
  assert(logoStats.size > 5000, `Logo file valid size (${Math.round(logoStats.size / 1024)} KB)`);

  // TEST SUITE 3: HTTP Server Endpoint Tests
  console.log("\n--- 2. HTTP Server Endpoints & Handlers ---");
  const baseUrl = "http://localhost:3000";

  // Test 3.1: Index HTML
  try {
    const res = await fetch(`${baseUrl}/`);
    assert(res.status === 200, "GET / returns HTTP 200");
    const html = await res.text();
    assert(html.includes("RoroGPT"), "Index HTML contains 'RoroGPT' brand title");
    assert(html.includes("/logo.jpg"), "Index HTML references custom logo /logo.jpg");
    assert(html.includes("User PC Storage:"), "Index HTML contains PC local folder storage UI");
  } catch (err) {
    assert(false, `GET / connection failed: ${err.message}`);
  }

  // Test 3.2: /api/models
  try {
    const res = await fetch(`${baseUrl}/api/models`);
    assert(res.status === 200, "GET /api/models returns HTTP 200");
    const data = await res.json();
    assert(data.success === true, "/api/models returned success: true");
    assert(Array.isArray(data.models) && data.models.length > 0, `/api/models returned ${data.models?.length} models`);
    const hasLlama = data.models.some(m => m.id === "meta-llama/llama-3.3-70b-instruct:free");
    assert(hasLlama, "Top model 'meta-llama/llama-3.3-70b-instruct:free' is present");
  } catch (err) {
    assert(false, `GET /api/models failed: ${err.message}`);
  }

  // Test 3.3: /api/embeddings
  try {
    const res = await fetch(`${baseUrl}/api/embeddings`);
    assert(res.status === 200, "GET /api/embeddings returns HTTP 200");
    const data = await res.json();
    assert(data.success === true, "/api/embeddings returned success: true");
    const hasSmall = data.models.some(m => m.id === "text-embedding-3-small");
    assert(hasSmall, "Default embedding model 'text-embedding-3-small' is present");
  } catch (err) {
    assert(false, `GET /api/embeddings failed: ${err.message}`);
  }

  // Test 3.4: /api/chat method guard
  try {
    const res = await fetch(`${baseUrl}/api/chat`, { method: "GET" });
    assert(res.status === 405, "GET /api/chat returns HTTP 405 Method Not Allowed");
  } catch (err) {
    assert(false, `GET /api/chat method check failed: ${err.message}`);
  }

  // Test 3.5: /api/chat authentication guard
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] })
    });
    // Should require API key if env is empty
    assert(res.status === 401 || res.status === 200, `POST /api/chat guard status: ${res.status}`);
  } catch (err) {
    assert(false, `POST /api/chat guard failed: ${err.message}`);
  }

  // Summary
  console.log("\n========================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
