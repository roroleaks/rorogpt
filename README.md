# 🌈 RoroGPT

> **A vibrant, colorful, and completely free AI chat web application powered by OpenRouter's free tier models. Designed for seamless 1-click deployment on Vercel.**

![RoroGPT Logo](public/logo.jpg)

---

## ✨ Features

- **100% Free AI Models**: Uses OpenRouter free models (`https://openrouter.ai/models?max_price=0`).
  - **★ Best Default**: `meta-llama/llama-3.3-70b-instruct:free` (Llama 3.3 70B - flagship reasoning and coding).
  - `deepseek/deepseek-r1:free` (Thinking model with real-time collapsible chain-of-thought).
  - `google/gemini-2.0-flash-exp:free` (Lightning-fast responses with massive context).
  - `qwen/qwen-2.5-coder-32b-instruct:free` (Dedicated coding specialist).
  - `mistralai/mistral-small-24b-instruct-2501:free` (Compact and accurate).
  - `openrouter/auto` (Automatic free router).
- **🎨 Colorful, Vibrant Themes**:
  - 🌈 **Neon Aurora** (Default dark with glowing neon pink, electric violet, and cyan)
  - 🌅 **Sunset Ember** (Warm crimson, coral, amber, and gold)
  - 🌊 **Cyber Ocean** (Bioluminescent electric teal, cobalt, and cyan)
  - 🍇 **Cosmic Violet** (Deep nebula plum, amethyst, and neon lavender)
  - 🍭 **Candy Pop** (High-contrast, colorful daylight mode)
- **🧠 Customizable Embedding Models**:
  - Switch embedding models easily in the **Models & Tools Studio**:
    - `text-embedding-3-small` (Recommended default)
    - `baai/bge-m3` (Multilingual)
    - `nomic-ai/nomic-embed-text-v1.5` (Open source)
    - Or type any custom embedding model ID.
  - Built-in **Semantic Similarity Tester** to compute vector embeddings and live cosine similarity percentages!
- **⚡ Real-time SSE Token Streaming**: ChatGPT-like instantaneous typing animation and token streaming.
- **💭 Thinking Process Viewer**: Real-time expandable and collapsible thinking block for DeepSeek R1 and Gemini Thinking models.
- **💻 Markdown & Syntax Highlighting**: Tokyo-Night dark code blocks with language headers and 1-click **Copy Code** button.
- **📐 KaTeX Math Formulas**: Beautiful rendering of LaTeX math ($...$ and $$...$$).
- **🔊 Voice Synthesis (TTS)**: Read any bot response aloud with 1 click.
- **📁 Chat History & Persistence**: Multiple chats saved locally in `localStorage`, search chats, rename, and export to Markdown.
- **☁️ Vercel Native**: Zero build config required. Works right out of the box with Vercel Serverless Functions.

---

## 🚀 Quick Start (Local Development)

### 1. Configure your OpenRouter API Key
Create a `.env` file or enter your key in the web app UI:
```bash
# In .env:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```
*(Get your free key at [openrouter.ai/keys](https://openrouter.ai/keys))*

### 2. Start the App
Double-click `run.bat` or run in terminal:
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## ▲ Deploying to Vercel (1-Click)

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for RoroGPT"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rorogpt.git
   git push -u origin main
   ```
2. Go to **[vercel.com/new](https://vercel.com/new)** and import your repository.
3. Under **Environment Variables**, add:
   - **Key**: `OPENROUTER_API_KEY`
   - **Value**: `sk-or-v1-...`
4. Click **Deploy**! Your app is live with SSL, global CDN, and unlimited free chat.

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
│   ├── app.js          # Client state, streaming reader, KaTeX, highlight.js
│   ├── logo.jpg        # RoroGPT cheerful mascot avatar & favicon
│   └── favicon.svg     # Vector fallback icon
├── .env.example        # Environment variable template
├── package.json        # Node.js project configuration
├── vercel.json         # Vercel deployment configuration
├── server.js           # Lightweight local development server
└── run.bat             # 1-click Windows launcher
```

---

## 📄 License
MIT License. Built with ❤️ for Roro.
