# RoroGPT Development Guidelines & Mandatory Workflow Rules

This document outlines the required workflows and quality gates for every change made to the RoroGPT codebase.

---

## 1. Mandatory Mobile & Desktop Parity
- **Every UI / Feature Edit Must Apply to Both Desktop and Mobile**:
  - Whenever a UI element, button, modal dialog, menu, setting, or workflow is added, modified, or removed, the change **MUST** be explicitly applied, styled, and verified for **both desktop and mobile viewports** (`<= 768px` and `<= 480px`).
  - Mobile touch interactions, swipe behaviors, scroll overflows, and accessible touch target sizes (minimum 40–44px) must be preserved.
  - Do not introduce desktop-only elements without corresponding mobile responsive behavior.

---

## 2. Full Test Suite Verification (`npm test`)
- Run `npm test` after **every** code modification.
- **100% Pass Rate Required**: All test suites (unit, security, server, mobile, DOM, and integration) must pass with **0 failures**.
- **Deterministic & Offline**: Default tests must make **0 external network calls**, using internal mock adapters where appropriate.
- If a feature change modifies existing element IDs, classes, or behavior, update the corresponding assertions in `test.js` to keep the entire suite green.

---

## 3. Snapshot ZIP Archive Update
- After implementing and verifying any change, create and overwrite the snapshot ZIP files on the user's PC:
  - `C:\Users\raouf.RAOUFDESKTOP\Desktop\rorogpt-snapshot.zip`
  - `C:\Users\raouf.RAOUFDESKTOP\Downloads\rorogpt-snapshot.zip`
- Generate using:
  ```powershell
  git archive --format=zip HEAD -o "C:\Users\raouf.RAOUFDESKTOP\Desktop\rorogpt-snapshot.zip"
  git archive --format=zip HEAD -o "C:\Users\raouf.RAOUFDESKTOP\Downloads\rorogpt-snapshot.zip"
  ```

---

## 4. Dependencies & Core Architectural Constraints
- **Do NOT touch `package.json` or `package-lock.json`**: Current dependency pins must remain untouched.
- **Strict Free-Only Policy**: RoroGPT only supports free, developer-tier, or local offline AI models (Groq, Google AI Studio Gemini, Cerebras Cloud, Local Ollama). OpenRouter and paid-credit providers are strictly forbidden.
- **Environment Keys**: Server-side API credentials live exclusively in `.env` and must never be committed to tracked repository files or exposed client-side.
