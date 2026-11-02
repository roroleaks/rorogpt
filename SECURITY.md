# Security Policy & Vulnerability Management

## 1. Reporting Security Issues
If you discover a potential security vulnerability in RoroGPT, please contact the maintainer directly or open a private security advisory on GitHub.

---

## 2. Dependency Audit & Non-Exploitability Analysis

As of audit date 2026-11-02, an `npm audit` run flags 2 advisories in dependencies. Per project guidelines (`AGENTS.md` §4), dependency lockfiles are strictly frozen. Below is the technical triage demonstrating **non-exploitability** in the deployed application:

### A. `dompurify` (Advisory: GHSA-cg2g-xh64-v4q7, GHSA-mrv2-3pqr-j5jr)
- **Reported Severity**: Critical / High (SAFE_FOR_TEMPLATES bypass & IN_PLACE hook mutations)
- **Role in Codebase**:
  - The `dompurify` entry in `package.json` is installed exclusively as a test-environment support dependency for headless DOM assertions inside `test.js` (`jsdom`).
  - The production client (`public/app.js` and `public/index.html`) does **not** bundle or import the `node_modules/dompurify` package.
  - Instead, the browser frontend uses a standalone, vendored distribution (`public/purify.min.js`).
- **Exploitability Analysis**:
  - The reported vulnerabilities apply only when using DOMPurify with `SAFE_FOR_TEMPLATES: true` (evaluating angular/vue template syntax inside shadow roots) or utilizing complex `IN_PLACE` node-removal hooks.
  - RoroGPT's markdown sanitization pipeline uses pure standard sanitization without template engines or unparsed XML media types.
  - **Verdict**: Non-exploitable in production runtime.

### B. `undici` (Advisories: GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx)
- **Reported Severity**: High (Redirect cache poisoning & decompression handling in undici HTTP client)
- **Role in Codebase**:
  - `undici` is a transitive dependency pulled in strictly by `jsdom` for running the automated unit test suite (`test.js`).
  - Production server handlers (`server.js`, `api/chat.js`, `api/fetch-url.js`, `api/models.js`, `api/embeddings.js`) do **not** use `undici`.
  - Outbound HTTP/HTTPS requests in RoroGPT use Node's native HTTP/HTTPS modules and global `fetch` with manual, hop-by-hop SSRF validation (`api/fetch-url.js`).
- **Verdict**: Non-exploitable in production runtime.

---

## 3. Runtime Security Features
RoroGPT implements multiple defense-in-depth layers at runtime:
1. **Production Token Gate (`APP_API_TOKEN`)**: Secures API routes from programmatic key drainage.
2. **CORS Origin Validation**: Prevents unauthorized cross-origin requests (`ALLOWED_ORIGINS`).
3. **SSRF Guard with DNS Rebinding Defense**: Inspects resolved IP addresses and connected socket peers on every redirect hop, blocking loopback, RFC 1918 private subnets, cloud metadata (`169.254.169.254`), and IPv6 equivalents.
4. **Content-Security-Policy `frame-ancestors`**: Restricts framing to `'self'`, `https://rorogpt.uk`, `https://*.rorogpt.uk`, and approved suite domains.
5. **Sliding-Window Rate Limiting**: Enforces strict per-IP request limits with bounded in-memory storage.
