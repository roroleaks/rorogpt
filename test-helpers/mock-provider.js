// Mock Chat Provider for Deterministic Offline Testing in RoroGPT
import http from "node:http";

export function createMockChatProvider() {
  const recordedRequests = [];
  let customHandler = null;

  const server = http.createServer((req, res) => {
    let rawBody = "";
    req.on("data", chunk => {
      rawBody += chunk;
    });

    req.on("end", async () => {
      let parsedBody = {};
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        parsedBody = rawBody;
      }

      const originalTargetUrl = req.headers["x-original-target-url"] || "";
      const record = {
        url: originalTargetUrl,
        headers: { ...req.headers },
        body: parsedBody,
        method: req.method
      };
      recordedRequests.push(record);

      if (customHandler) {
        return customHandler(req, res, record);
      }

      // Default behavior: standard 2-chunk OpenAI SSE stream
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      res.write(`data: ${JSON.stringify({
        id: "chatcmpl-mock-default",
        object: "chat.completion.chunk",
        model: parsedBody.model || "mock-model",
        choices: [{ index: 0, delta: { role: "assistant", content: "Hello" } }]
      })}\n\n`);

      res.write(`data: ${JSON.stringify({
        id: "chatcmpl-mock-default",
        object: "chat.completion.chunk",
        model: parsedBody.model || "mock-model",
        choices: [{ index: 0, delta: { content: " from mock provider!" } }]
      })}\n\n`);

      res.write("data: [DONE]\n\n");
      res.end();
    });
  });

  let port = 0;

  return {
    async start() {
      await new Promise(resolve => {
        server.listen(0, "127.0.0.1", () => {
          port = server.address().port;
          resolve();
        });
      });
      return port;
    },
    getPort() {
      return port;
    },
    setHandler(fn) {
      customHandler = fn;
    },
    getRequests() {
      return [...recordedRequests];
    },
    getLastRequest() {
      return recordedRequests[recordedRequests.length - 1] || null;
    },
    clearRequests() {
      recordedRequests.length = 0;
    },
    fetchAdapter: async (targetUrl, init = {}) => {
      const headers = new Headers(init.headers || {});
      headers.set("x-original-target-url", targetUrl);

      return fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: init.method || "POST",
        headers,
        body: init.body,
        signal: init.signal
      });
    },
    async close() {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise(resolve => server.close(resolve));
    }
  };
}
