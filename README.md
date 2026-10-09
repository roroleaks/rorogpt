# 🌈 RoroGPT

> **A vibrant, colorful, and completely free AI chat web application powered by OpenRouter's free tier models. Designed for seamless 1-click deployment on Vercel with local PC chat storage.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roroleaks/rorogpt&env=OPENROUTER_API_KEY&envDescription=Your%20OpenRouter%20API%20Key&envLink=https://openrouter.ai/keys)
[![GitHub Repo](https://img.shields.io/badge/GitHub-roroleaks%2Frorogpt-blue?logo=github)](https://github.com/roroleaks/rorogpt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="public/logo.jpg" alt="RoroGPT Logo" width="180" style="border-radius: 50%; box-shadow: 0 0 25px rgba(139, 92, 246, 0.5);" />
</p>

---

## ✨ Key Features

- **100% Free AI Models**: Uses OpenRouter's free tier (`https://openrouter.ai/openrouter/free`).
  - **★ Best Default**: `meta-llama/llama-3.3-70b-instruct:free` (Llama 3.3 70B - Meta's flagship model with 128K context, high-tier reasoning, and code intelligence).
  - 🧠 `deepseek/deepseek-r1:free` (Reasoning model with real-time collapsible chain-of-thought "Thinking Process").
  - ⚡ `google/gemini-2.0-flash-exp:free` (Blazing fast speed with massive context).
  - 💻 `qwen/qwen-2.5-coder-32b-instruct:free` (Specialized in programming and debugging).
  - 🌪️ `mistralai/mistral-small-24b-instruct-2501:free` (Balanced, concise responses).
  - 🤖 `openrouter/free` (Automatic free model routing).
  - 🔀 **Custom Model Input**: Enter any OpenRouter model identifier anytime.

- **💾 Save Chats to User PC Special Folder (Not on Server)**:
  - **Zero Server Storage**: Your chats are never stored on Vercel servers or cloud databases.
  - **Native PC Folder Sync**: Pick any folder on your computer (e.g. `Documents/RoroGPT_Chats`) using the browser's native File System Access API.
  - **Dual Auto-Save**: Conversations are automatically written directly to your PC hard drive as:
    1. **`.md` (Markdown)**: Beautiful, readable format with user/bot sections and timestamps.
    2. **`.json` (JSON)**: Full structured conversation data with role history.
  - **Import & Backup**: One-click to reload or backup chats directly from your PC folder.

- **🧠 Customizable Embedding Models**:
  - Switch embedding models in the **Models & Tools Studio**:
    - **★ Best Default**: `text-embedding-3-small` (OpenAI)
    - `baai/bge-m3` (Multilingual)
    - `nomic-ai/nomic-embed-text-v1.5` (Open source)
    - Or any custom embedding model ID.
  - **Semantic Similarity Tester**: Test vector embeddings and live cosine similarity percentages between two text snippets in real-time!

- **🎨 5 Vibrant Themes ("Must be colorful")**:
  - 🌈 **Neon Aurora** *(Default)*: Deep obsidian with glowing neon pink, electric violet, cyan, and lime accents.
  - 🌅 **Sunset Ember**: Warm crimson, coral, amber, and gold.
  - 🌊 **Cyber Ocean**: High-tech bioluminescent electric teal and cobalt blue.
  - 🍇 **Cosmic Violet**: Deep space galactic nebula with vivid amethyst and magenta.
  - 🍭 **Candy Pop**: High-contrast, colorful daylight mode.

- **⚡ Modern Chat Experience**:
  - Real-time Server-Sent Events (SSE) token streaming.
  - Tokyo-Night dark code blocks with language labels and 1-click **Copy Code** button.
  - KaTeX math formula rendering ($\dots$ and $$\dots$$).
  - Text-to-Speech (read bot responses aloud).
  - Stop generation & Regenerate controls.
  - Sound SFX synthesized audio feedback (toggleable).

---

## 🚀 Quick Start (Local PC)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or later.

### 2. Run the App
Double-click `run.bat` or run in terminal:
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 3. Set Your Free API Key
- Enter your key in the **Settings ⚙️** modal inside the web app (stored securely in your browser), OR
- Create a `.env` file from `.env.example`:
  ```env
  OPENROUTER_API_KEY=sk-or-v1-your-key-here
  ```
  *(Get your free key at [openrouter.ai/keys](https://openrouter.ai/keys))*

---

## ▲ Deploying to Vercel (1-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roroleaks/rorogpt&env=OPENROUTER_API_KEY&envDescription=Your%20OpenRouter%20API%20Key&envLink=https://openrouter.ai/keys)

1. Click the **Deploy with Vercel** button above or import [`roroleaks/rorogpt`](https://github.com/roroleaks/rorogpt) at [vercel.com/new](https://vercel.com/new).
2. Under **Environment Variables**, add:
   - **Key**: `OPENROUTER_API_KEY`
   - **Value**: `sk-or-v1-...`
3. Click **Deploy**. Your app is live with global CDN, SSL, and serverless edge streaming!

---

## 🛠️ Project Structure

```
rorogpt/
├── api/
│   ├── chat.js         # Streaming SSE completions handler (Vercel serverless)
│   ├── models.js       # Curated + dynamic free models provider
│   └── embeddings.js   # Embeddings calculation & similarity endpoint
├── public/
│   ├── index.html      # Responsive colorful UI with modals and drawers
│   ├── style.css       # 5 vibrant theme palettes, glows, glassmorphism
│   ├── app.js          # Client state, streaming reader, PC file storage
│   ├── logo.jpg        # RoroGPT smiling mascot avatar & favicon
│   └── favicon.svg     # Vector fallback icon
├── .env.example        # Environment variable template
├── package.json        # Node.js project configuration
├── vercel.json         # Vercel deployment configuration
├── server.js           # Lightweight local development server
└── run.bat             # 1-click Windows launcher
```

---

## 🔒 Privacy & Local Storage
- RoroGPT does **NOT** store your conversations on any server or database.
- Chat history is stored strictly on your local PC via `localStorage` and your chosen PC directory using the Web File System Access API.

---

## 📄 License
MIT License. Built with ❤️ for Roro.
