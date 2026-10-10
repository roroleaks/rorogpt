// Opt-In Live Smoke Tests for RoroGPT (Free-Tier Providers)
// Requires explicit RUN_LIVE_TESTS=1 environment variable.
// Consumes provider quota and contacts real external APIs.
import http from "node:http";
import "dotenv/config";

async function runLiveTests() {
  console.log("\n========================================================");
  console.log("   🌐 RoroGPT - OPT-IN LIVE PROVIDER SMOKE TESTS       ");
  console.log("========================================================\n");

  if (process.env.RUN_LIVE_TESTS !== "1") {
    console.log("  ⚠️  Live tests skipped.");
    console.log("  To execute live smoke tests against real free-tier AI providers, run:");
    console.log("    RUN_LIVE_TESTS=1 npm run test:live\n");
    console.log("  Notice: Live tests consume provider free-tier quota and may be");
    console.log("  rate-limited or temporarily unavailable under provider terms.");
    console.log("========================================================\n");
    process.exit(0);
  }

  // Identify configured provider
  let provider = null;
  let modelId = null;
  let testKey = null;

  if (process.env.GROQ_API_KEY) {
    provider = "groq";
    modelId = "qwen/qwen3.8-27b";
    testKey = process.env.GROQ_API_KEY;
  } else if (process.env.GEMINI_API_KEY) {
    provider = "gemini";
    modelId = "gemini-2.0-flash";
    testKey = process.env.GEMINI_API_KEY;
  } else if (process.env.CEREBRAS_API_KEY) {
    provider = "cerebras";
    modelId = "llama3.1-8b";
    testKey = process.env.CEREBRAS_API_KEY;
  }

  if (!provider) {
    console.error("  ❌ Live smoke test failed: No provider API credentials configured in .env.");
    console.error("  Please set GROQ_API_KEY, GEMINI_API_KEY, or CEREBRAS_API_KEY to test live endpoints.");
    process.exit(1);
  }

  console.log(`  🔍 Testing live streaming with provider: ${provider} (Model: ${modelId})...`);

  process.env.AUTORUN_SERVER = "false";
  const { server } = await import("./server.js");

  let serverPort = 0;
  await new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${serverPort}`;

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model: modelId,
        apiKey: testKey,
        messages: [{ role: "user", content: "ping" }]
      })
    });

    if (res.status === 429) {
      console.warn("  ⚠️  Provider rate limit reached (HTTP 429). Free-tier quota may be temporarily saturated.");
      console.warn("  The application handled the quota limit safely.");
      return;
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`Live test request failed with status ${res.status}: ${errJson.error || "Unknown error"}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Expected text/event-stream but received ${contentType}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let receivedChunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      if (text.includes("data: ")) receivedChunks++;
    }

    console.log(`  ✅ Live test succeeded: Received ${receivedChunks} streamed SSE event chunks.`);
  } catch (err) {
    console.error(`  ❌ Live test failure: ${err.message}`);
    process.exit(1);
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise(resolve => server.close(resolve));
  }

  console.log("\n========================================================");
  console.log("   ✅ LIVE SMOKE TEST COMPLETE                          ");
  console.log("========================================================\n");
}

runLiveTests().catch(err => {
  console.error("Fatal live test error:", err);
  process.exit(1);
});
