# 🌈 RoroGPT

> **A vibrant, colorful, and 100% free AI chat web application powered by ultra-fast free models (Groq LPUs, Google Gemini, Cerebras, and Local Ollama). Designed for seamless deployment on Vercel with local PC chat storage.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roroleaks/rorogpt)
[![GitHub Repo](https://img.shields.io/badge/GitHub-roroleaks%2Frorogpt-blue?logo=github)](https://github.com/roroleaks/rorogpt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="public/logo.jpg" alt="RoroGPT Logo" width="180" style="border-radius: 24px; box-shadow: 0 0 35px rgba(59, 130, 246, 0.6);" />
</p>

---

## ✨ Free-Tier AI & No-Payment Provider Policy

RoroGPT is strictly designed for **free AI access with zero paid credits, zero purchases, and no billing requirement**. OpenRouter and all paid-only services are completely unsupported.

RoroGPT supports four distinct free-access options:

### 1. ⚡ Groq Cloud (Developer Free Tier • Ultra-Fast)
- **Status**: Available on Groq's developer free tier where eligible (subject to Groq terms and rate limits).
- **Performance**: Generates answers in sub-second speeds (~500 tok/s) on custom LPUs.
- **Models**:
  - `qwen/qwen3.8-27b`: Fast and capable 27B model on Groq LPUs.
  - `openai/gpt-oss-120b`: Flagship 120B reasoning model with 131K context.
  - `openai/gpt-oss-20b`: Fast 20B model for coding and concise answers.
  - `deepseek-r1-distill-llama-70b`: Deep reasoning with chain-of-thought.
  - `allam-2-7b`: 7B Arabic/English bilingual model.
- **Get Free Key**: [console.groq.com/keys](https://console.groq.com/keys) (Groq developer tier account required).

### 2. 🌟 Google Gemini (Google AI Studio Free Tier)
- **Status**: Available on Google AI Studio's free tier where eligible (subject to regional availability and quota policies).
- **Models**: `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro` with large context windows.
- **Get Free Key**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 3. 🚀 Cerebras Cloud (Developer Free Tier)
- **Status**: Available on Cerebras Cloud free tier where eligible (subject to Cerebras rate limits and terms).
- **Performance**: 1800+ tokens/second inference on CS-3 wafer-scale engines.
- **Models**: `cerebras/llama3.1-70b`, `cerebras/llama3.1-8b`.
- **Get Free Key**: [cloud.cerebras.ai](https://cloud.cerebras.ai).

### 4. 💻 Local Ollama (100% Offline & Private)
- **Status**: Completely free and runs locally on your PC hardware.
- **Keys**: **Zero API keys needed**. No cloud data sharing or payment accounts.
- **Setup**: Install [Ollama](https://ollama.com) on your machine. Start Ollama and pull any model (e.g. `ollama run llama3.2`).
- **Default Endpoint**: `http://127.0.0.1:11434`. Configurable via `OLLAMA_BASE_URL`.
- **Models**: `ollama/llama3.2`, `ollama/mistral`, `ollama/qwen2.5-coder`, `ollama/deepseek-r1`.

> **Note on Free Tiers**: Third-party cloud free tiers (Groq, Gemini, Cerebras) are governed by their respective providers' usage quotas, regional eligibility, and terms of service. Local Ollama operates entirely on your hardware with zero API keys or limits.

---

## 💾 Save Chats to User PC Folder (Never on Server)

- **Zero Server Retention**: Conversations are never saved on Vercel servers or cloud databases.
- **Native PC Folder Sync**: Pick any folder on your computer (e.g. `Documents/RoroGPT_Chats`) using the browser's native File System Access API.
- **Dual Auto-Save**: Conversations are automatically written directly to your PC hard drive as:
  1. **`.md` (Markdown)**: Beautiful, readable format with user/bot sections and timestamps.
  2. **`.json` (JSON)**: Full structured conversation data with role history.
- **One-Click Backup & Reload**: Seamlessly load prior conversations from your local directory.

---

## 🎨 Vibrant Themes & UI

- 🌈 **Neon Aurora** *(Default)*: Deep obsidian with glowing neon pink, electric violet, cyan, and lime accents.
- 🌅 **Sunset Ember**: Warm crimson, coral, amber, and gold.
- 🌊 **Cyber Ocean**: Bioluminescent electric teal and cobalt blue.
- 🍇 **Cosmic Violet**: Deep space galactic nebula with vivid amethyst and magenta.
- 🍭 **Candy Pop**: High-contrast, colorful daylight mode.

---

## 🚀 Quick Start (Local PC)

### 1. Run the Local Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 2. Add Your Free API Key
- Click **Settings ⚙️** inside the web app.
- Paste your 100% Free Groq key (`gsk_...`) or Gemini key (`AIza...`).
- It saves securely in your browser's localStorage!

---

## ▲ Deploying to Vercel

```bash
vercel --prod --yes
```

Or deploy via GitHub at [https://github.com/roroleaks/rorogpt](https://github.com/roroleaks/rorogpt).

---

## 🛡️ Security Access Boundary & Abuse Prevention

RoroGPT includes a hardened access boundary designed to prevent abuse and proxy draining in deployed environments while maintaining zero-friction local development:

### 1. Production API Lockdown (`APP_API_TOKEN`)
- **Prevent Anonymous Key Drain**: In production mode (`NODE_ENV=production`), `/api/chat` and `/api/fetch-url` require a server-side `APP_API_TOKEN` to prevent unauthorized third parties from consuming your configured provider keys.
- **Pass Token**: Supply your token via the `x-app-token` header, request body `appToken`, or directly in the **Settings ⚙️** modal under *Instance Access Token*.
- **Local Dev Mode**: Running locally with `npm start` (`NODE_ENV=development`) allows immediate, tokenless use out of the box.

### 2. Configurable CORS Allowlist (`ALLOWED_ORIGINS`)
- Replaces unrestricted wildcards (`*`) with a strict, configurable origin allowlist (e.g. `ALLOWED_ORIGINS=https://rorogpt.uk,https://rorogpt.vercel.app`).
- Disallowed cross-origin browser requests are rejected with **HTTP 403 Forbidden**.
- In local development mode, loopback (`localhost`, `127.0.0.1`) is permitted automatically.

### 3. Per-IP Rate Limiting (Sliding Window)
- Bounded in-memory sliding window rate limiter protects server resources without unbounded memory growth:
  - `RATE_LIMIT_WINDOW_MS`: Window duration in ms (default: `60000` = 1 minute).
  - `RATE_LIMIT_MAX_CHAT`: Max chat requests per IP per window (default: `30`).
  - `RATE_LIMIT_MAX_FETCH`: Max URL retrievals per IP per window (default: `20`).
- Rejections return **HTTP 429** with a `Retry-After` header and clean JSON error messages.
- *Production Note*: For multi-instance, distributed deployments, a shared store (such as Upstash Redis) is recommended.

### 4. Hardened Security Headers
All responses automatically include:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), interest-cohort=()`
- `X-Frame-Options: SAMEORIGIN`

### 5. Incremental Streaming URL Retrieval Guard (`/api/fetch-url`)
- **Pre-check `Content-Length`**: Rejects responses advertising sizes > 1.5 MB immediately with HTTP 413 before reading the body.
- **Incremental Streaming Byte Limit**: Reads stream chunks using `Uint8Array.byteLength`. If the running byte total exceeds 1.5 MB (1,572,864 bytes), stream consumption is halted, the reader cancelled, and HTTP 413 returned.
- **Identity Encoding**: Requests `Accept-Encoding: identity` so the byte limit applies directly without compression expansion or decompression bomb risks.
- **Leak-Free Timer Cleanup**: Guarantees request timeout timers are always cleared in a `finally` block.

### 6. Redirect & DNS-Rebinding SSRF Hardening (`/api/fetch-url`)
- **Manual Bounded Redirects**: Outbound requests never follow redirects automatically. Redirects are followed manually with a maximum limit of 5 hops (`MAX_REDIRECTS = 5`).
- **Per-Hop Pre-Validation**: Every redirect `Location` is resolved and completely validated against SSRF rules before initiating the next connection. Private IPv4, loopback, cloud metadata (169.254.169.254), link-local, private IPv6, and IPv4-mapped IPv6 are blocked with HTTP 403.
- **Redirect Loop & Protocol Safety**: Redirect loops are tracked and blocked. Unsupported protocols (such as `file:`) are rejected with HTTP 400.
- **Connected Peer & DNS Rebinding Verification**: Verifies all resolved DNS addresses and inspects `socket.remoteAddress` directly on the connected TCP/TLS socket. If the connected peer IP is private or attempts a DNS rebind swap, the socket is immediately destroyed before HTTP data transmission.

---

## 🧪 Automated Testing

RoroGPT features a 100% deterministic, offline-capable test suite that requires **zero external credentials** and makes **zero calls to external AI providers or public websites**.

### 1. Default Deterministic Suite (`npm test`)

Run the complete automated test suite:
```bash
npm test
```

#### What the Default Suite Covers:
- **Offline & Deterministic Execution**: Binds native test servers to dynamic ephemeral ports (port 0) and uses a local mock upstream chat provider. No real Groq, Gemini, Cerebras, or Ollama services are contacted.
- **Upstream Chat Provider Mocking & SSE**: Tests multi-chunk OpenAI-compatible SSE streaming, reasoning deltas (`delta.reasoning` / `delta.reasoning_content`), normal content deltas, `[DONE]` termination, provider errors (JSON and plain-text), final partial chunks without trailing newlines, and client-side cancellation.
- **Native Server & Routing Integrity**: Verifies `GET /`, MIME types for static assets (`.html`, `.css`, `.js`, `.svg`, `.jpg`), SPA route fallback, 404 behavior on missing static files, unsupported HTTP method errors (405), malformed request body handling, and 2 MB request-body limits (413).
- **Free-Only Catalog & Provider Policy**: Validates that only approved free-tier providers (`groq`, `gemini`, `cerebras`, `ollama`) are advertised. Rejects OpenRouter, `:free` suffixes, and uncataloged models. Ensures all model notices carry terms and quota caveats.
- **Semantic Vector Embeddings**: Validates `free-fast-vector` (256 dimensions) and `free-multilingual-ngram` (512 dimensions) vector generation, batch arrays, null/empty/mixed-type input rejection (HTTP 400), and crash-resilient error recovery.
- **SSRF & DNS-Rebinding Hardening**: Tests manual redirect tracking (5 hops), redirect loop prevention, and socket peer validation blocking localhost, private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), IPv6 loopback (`[::1]`), and cloud metadata (`169.254.169.254`).
- **Client-Side Markdown & XSS Defense**: Verifies DOMPurify sanitization stripping executable scripts, malicious event handlers (`onerror`, `onload`), dangerous URI schemes (`javascript:`, `vbscript:`, `data:`), KaTeX formula safety, and safe link formatting.
- **Safe innerHTML & Attachment Storage**: Verifies safe DOM node generation, IndexedDB binary storage for image attachments outside `localStorage`, quota error recovery, and consistent model metadata attribution across chat exports (`.md` and `.json`).
- **Network Call Monitor**: Actively monitors all outbound network calls during execution and verifies that **exactly 0 external calls** were attempted.

### 2. Opt-In Live Smoke Tests (`npm run test:live`)

To validate real upstream cloud streaming against live free-tier providers using your configured `.env` keys:

```bash
RUN_LIVE_TESTS=1 npm run test:live
```

> **Notice on Live Tests**: Live tests require an explicit `RUN_LIVE_TESTS=1` flag and a configured `GROQ_API_KEY`, `GEMINI_API_KEY`, or `CEREBRAS_API_KEY`. Live tests consume provider free-tier quota and may be rate-limited or unavailable if quotas are exhausted. Live tests never run during standard CI or `npm test`.

---

## 📄 License
MIT License. Created for the community.
