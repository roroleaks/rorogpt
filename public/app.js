/**
 * 🌈 ROROGPT - Modern, Colorful Free AI Chat Web App
 * Powered by 100% Free AI Models (Groq, Gemini, Cerebras, Local Ollama) & Vercel
 */

// Default Configuration: 100% Free & Fastest Model by Default (Groq Qwen 3.8 27B or GPT OSS 120B)
const DEFAULT_CHAT_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_EMBEDDING_MODEL = "free-fast-vector";

let initialModel = localStorage.getItem("roro_active_model");
if (!initialModel || initialModel.includes("llama-3.1") || initialModel.includes("llama-3.3")) {
  initialModel = DEFAULT_CHAT_MODEL;
  localStorage.setItem("roro_active_model", DEFAULT_CHAT_MODEL);
}

// State
const state = {
  activeModel: initialModel,
  activeEmbeddingModel: localStorage.getItem("roro_active_embed_model") || DEFAULT_EMBEDDING_MODEL,
  apiKey: localStorage.getItem("roro_api_key") || "",
  systemPrompt: localStorage.getItem("roro_system_prompt") || "",
  temperature: parseFloat(localStorage.getItem("roro_temperature") || "0.7"),
  currentTheme: (localStorage.getItem("roro_theme") === "candy-pop" ? "neon-aurora" : (localStorage.getItem("roro_theme") || "neon-aurora")),
  soundEnabled: localStorage.getItem("roro_sfx") !== "false",
  currentChatId: null,
  chats: {},
  models: [],
  embeddingModels: [],
  isGenerating: false,
  abortController: null,
  // PC Local Storage
  dirHandle: null,
  pcFolderName: localStorage.getItem("roro_pc_folder_name") || ""
};

// ==========================================================
// SOUND SFX (Web Audio API Synthesizer)
// ==========================================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playPop() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(540, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }
  playReceive() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }
}
const sfx = new SoundFX();

// ==========================================================
// DOM ELEMENTS
// ==========================================================
const DOM = {
  chatViewport: document.getElementById("chatViewport"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  welcomeActiveModel: document.getElementById("welcomeActiveModel"),
  messagesContainer: document.getElementById("messagesContainer"),
  chatInput: document.getElementById("chatInput"),
  sendBtn: document.getElementById("sendBtn"),
  generatingBar: document.getElementById("generatingBar"),
  stopGenerationBtn: document.getElementById("stopGenerationBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  conversationsList: document.getElementById("conversationsList"),
  searchChatsInput: document.getElementById("searchChatsInput"),
  sidebar: document.getElementById("sidebar"),
  menuToggleBtn: document.getElementById("menuToggleBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  apiKeyStatusBadge: document.getElementById("apiKeyStatusBadge"),
  // Model selector
  modelPillContainer: document.getElementById("modelPillContainer"),
  modelPillBtn: document.getElementById("modelPillBtn"),
  activeModelName: document.getElementById("activeModelName"),
  activeModelDot: document.getElementById("activeModelDot"),
  dropdownModelsList: document.getElementById("dropdownModelsList"),
  inputModelChip: document.getElementById("inputModelChip"),
  openCustomModelModal: document.getElementById("openCustomModelModal"),
  // Themes
  themePickerBtn: document.getElementById("themePickerBtn"),
  themeDropdownContainer: document.querySelector(".theme-dropdown-container"),
  themeOpts: document.querySelectorAll(".theme-opt"),
  // Settings Modal
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  toggleApiKeyVisibility: document.getElementById("toggleApiKeyVisibility"),
  systemPromptInput: document.getElementById("systemPromptInput"),
  temperatureSlider: document.getElementById("temperatureSlider"),
  temperatureValue: document.getElementById("temperatureValue"),
  // Embeddings Studio Modal
  openEmbeddingsBtn: document.getElementById("openEmbeddingsBtn"),
  embeddingsModal: document.getElementById("embeddingsModal"),
  fullModelsGrid: document.getElementById("fullModelsGrid"),
  embeddingsGrid: document.getElementById("embeddingsGrid"),
  customModelInput: document.getElementById("customModelInput"),
  applyCustomModelBtn: document.getElementById("applyCustomModelBtn"),
  customEmbeddingModelInput: document.getElementById("customEmbeddingModelInput"),
  applyCustomEmbeddingBtn: document.getElementById("applyCustomEmbeddingBtn"),
  // Embeddings Tester
  computeSimilarityBtn: document.getElementById("computeSimilarityBtn"),
  embedTextA: document.getElementById("embedTextA"),
  embedTextB: document.getElementById("embedTextB"),
  similarityResultCard: document.getElementById("similarityResultCard"),
  similarityPercentage: document.getElementById("similarityPercentage"),
  similarityMeterFill: document.getElementById("similarityMeterFill"),
  embedMetaDetails: document.getElementById("embedMetaDetails"),
  testerActiveModelBadge: document.getElementById("testerActiveModelBadge"),
  // Utilities
  clearChatBtn: document.getElementById("clearChatBtn"),
  exportChatBtn: document.getElementById("exportChatBtn"),
  sfxToggleBtn: document.getElementById("sfxToggleBtn"),
  toastContainer: document.getElementById("toastContainer"),
  // PC Local Storage DOM
  pcFolderCard: document.getElementById("pcFolderCard"),
  pcFolderDot: document.getElementById("pcFolderDot"),
  pcFolderName: document.getElementById("pcFolderName"),
  selectPcFolderBtn: document.getElementById("selectPcFolderBtn"),
  modalPcFolderDot: document.getElementById("modalPcFolderDot"),
  modalPcFolderName: document.getElementById("modalPcFolderName"),
  modalSelectFolderBtn: document.getElementById("modalSelectFolderBtn"),
  modalSyncNowBtn: document.getElementById("modalSyncNowBtn"),
  modalLoadFromPcBtn: document.getElementById("modalLoadFromPcBtn")
};

// ==========================================================
// TOAST NOTIFICATIONS
// ==========================================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</span><span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ==========================================================
// MARKDOWN & HIGHLIGHT INITIALIZATION
// ==========================================================
function setupMarkdown() {
  if (window.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (window.hljs) {
          const language = hljs.getLanguage(lang) ? lang : "plaintext";
          return hljs.highlight(code, { language }).value;
        }
        return code;
      }
    });
  }
}

// Render Markdown safely with Code Copy wrapper
function renderMarkdown(rawText) {
  if (!rawText) return "";
  let html = window.marked ? marked.parse(rawText) : rawText;

  // Render LaTeX math formulas if KaTeX is loaded
  if (window.katex) {
    // Display Math $$ ... $$
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return `<div class="katex-display">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch { return match; }
    });
    // Inline Math $ ... $
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch { return match; }
    });
  }

  // Wrap <pre><code> with colorful header & copy button
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  tempDiv.querySelectorAll("pre").forEach(pre => {
    const code = pre.querySelector("code");
    if (!code) return;

    let lang = "code";
    code.classList.forEach(cls => {
      if (cls.startsWith("language-")) {
        lang = cls.replace("language-", "");
      }
    });

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span class="code-lang">💻 ${lang.toUpperCase()}</span>
      <button class="copy-code-btn" title="Copy code">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Copy</span>
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  return tempDiv.innerHTML;
}

// ==========================================================
// THEME HANDLING
// ==========================================================
function setTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("roro_theme", theme);

  DOM.themeOpts.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-theme") === theme);
  });
}

// ==========================================================
// MODELS & EMBEDDINGS MANAGEMENT
// ==========================================================
async function fetchModels() {
  try {
    const res = await fetch("/api/models");
    const data = await res.json();
    if (data.success && Array.isArray(data.models)) {
      state.models = data.models;
    }
    updateApiKeyBadge(data.hasServerKey);
  } catch {
    // Fallback model list
    state.models = [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B",
        tagline: "Top All-Rounder",
        badge: "★ Best",
        color: "#8b5cf6",
        icon: "🦙",
        description: "Meta's flagship 70B model. Superior reasoning & coding."
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1",
        tagline: "Deep Reasoning",
        badge: "Thinking",
        color: "#3b82f6",
        icon: "🧠",
        description: "Chain-of-thought thinking for math, logic and coding."
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash",
        tagline: "Ultra Low Latency",
        badge: "Fastest",
        color: "#10b981",
        icon: "⚡",
        description: "Google's ultra fast multimodal model with large context."
      },
      {
        id: "qwen/qwen-2.5-coder-32b-instruct:free",
        name: "Qwen 2.5 Coder 32B",
        tagline: "Coding Specialist",
        badge: "Code",
        color: "#f59e0b",
        icon: "💻",
        description: "Exceptional coding accuracy and syntax generation."
      }
    ];
  }

  // Also fetch embedding models
  try {
    const embedRes = await fetch("/api/embeddings");
    const embedData = await embedRes.json();
    if (embedData.success && Array.isArray(embedData.models)) {
      state.embeddingModels = embedData.models;
    }
  } catch {
    state.embeddingModels = [
      { id: "text-embedding-3-small", name: "OpenAI Text Embedding 3 Small", dimensions: 1536, description: "Fast, accurate and cost-effective default model." },
      { id: "baai/bge-m3", name: "BGE M3 (Multilingual)", dimensions: 1024, description: "Powerful multilingual embeddings." },
      { id: "nomic-ai/nomic-embed-text-v1.5", name: "Nomic Embed Text v1.5", dimensions: 768, description: "Open embedding model with 8k context." }
    ];
  }

  renderModelsUI();
  renderEmbeddingsUI();
}

function updateApiKeyBadge(hasServerKey) {
  const k = (state.apiKey || "").trim();
  const hasUserKey = k.length > 5;
  const dot = DOM.apiKeyStatusBadge.querySelector(".status-dot");
  const text = DOM.apiKeyStatusBadge.querySelector(".status-text");

  if (k.startsWith("gsk_")) {
    dot.className = "status-dot active";
    text.textContent = "⚡ Groq Free Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Groq (100% Free, 500 tok/s)";
  } else if (k.startsWith("AIza")) {
    dot.className = "status-dot active";
    text.textContent = "🌟 Gemini Free Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Google AI Studio (100% Free)";
  } else if (k.startsWith("csk-")) {
    dot.className = "status-dot active";
    text.textContent = "⚡ Cerebras Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Cerebras Cloud (1800+ tok/s)";
  } else if (state.activeModel.startsWith("ollama/")) {
    dot.className = "status-dot active";
    text.textContent = "💻 Local Ollama (Offline)";
    DOM.apiKeyStatusBadge.title = "Connected to Local Ollama (0 Keys Required)";
  } else if (k.startsWith("sk-or-")) {
    dot.className = "status-dot active";
    text.textContent = "OpenRouter Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to OpenRouter";
  } else if (hasUserKey) {
    dot.className = "status-dot active";
    text.textContent = "Custom Key Active";
  } else if (hasServerKey) {
    dot.className = "status-dot active";
    text.textContent = "Server Key Connected";
  } else {
    dot.className = "status-dot";
    text.textContent = "No Free Key Set";
    DOM.apiKeyStatusBadge.title = "Click Settings to paste your 100% free Groq or Gemini key";
  }
}

function selectModel(modelId) {
  state.activeModel = modelId;
  localStorage.setItem("roro_active_model", modelId);

  const modelObj = state.models.find(m => m.id === modelId) || {
    id: modelId,
    name: modelId.split("/").pop().replace(":free", ""),
    speed: "⚡ Free",
    color: "#10b981"
  };

  const isBest = modelId === DEFAULT_CHAT_MODEL;

  DOM.activeModelName.textContent = modelObj.name;
  DOM.activeModelDot.style.background = modelObj.color || "#10b981";
  DOM.activeModelDot.style.boxShadow = `0 0 8px ${modelObj.color || "#10b981"}`;

  const bestBadge = DOM.modelPillBtn.querySelector(".best-badge");
  if (bestBadge) {
    bestBadge.style.display = "inline-block";
    bestBadge.textContent = isBest ? "⚡ Fastest" : (modelObj.speed || "Free");
  }

  // Update input chip
  DOM.inputModelChip.querySelector(".chip-name").textContent = `${modelObj.name} (${modelObj.speed || "Free"})`;
  DOM.inputModelChip.querySelector(".chip-dot").style.background = modelObj.color || "#10b981";

  // Update welcome hero
  if (DOM.welcomeActiveModel) {
    DOM.welcomeActiveModel.textContent = `${modelObj.name} (${modelObj.speed || "100% Free"})`;
  }

  // Close dropdown
  DOM.modelPillContainer.classList.remove("open");
  renderModelsUI();

  if (modelId.includes("r1")) {
    showToast(`DeepSeek R1 selected. Note: Generates deep reasoning before answering (~30-90s). Switch to Gemini 2.0 Flash for instant replies!`, "info");
  } else {
    showToast(`Switched to ${modelObj.name} (${modelObj.speed || "100% Free"})`, "info");
  }
}

function selectEmbeddingModel(modelId) {
  state.activeEmbeddingModel = modelId;
  localStorage.setItem("roro_active_embed_model", modelId);
  renderEmbeddingsUI();
  DOM.testerActiveModelBadge.textContent = `Model: ${modelId} (100% Free - 0 Cost)`;
  showToast(`Active embedding model set to ${modelId}`, "info");
}

function renderModelsUI() {
  // Dropdown list in topbar
  DOM.dropdownModelsList.innerHTML = "";
  state.models.forEach(m => {
    const isSelected = m.id === state.activeModel;
    const isBest = m.id === DEFAULT_CHAT_MODEL;

    const item = document.createElement("div");
    item.className = `model-option-item ${isSelected ? "selected" : ""}`;
    item.innerHTML = `
      <div class="option-left">
        <span class="option-icon">${m.icon || "✨"}</span>
        <div class="option-info">
          <span class="option-name">${m.name}</span>
          <span class="option-desc">${m.speed ? `${m.speed} • ` : ""}${m.description || m.tagline || ""}</span>
        </div>
      </div>
      <span class="option-badge" style="background: ${isBest ? "linear-gradient(135deg, #10b981, #06b6d4)" : "rgba(255, 255, 255, 0.1)"}">
        ${isBest ? "⚡ Fastest" : (m.badge || "Free")}
      </span>
    `;
    item.addEventListener("click", () => selectModel(m.id));
    DOM.dropdownModelsList.appendChild(item);
  });

  // Full models grid in Modal
  DOM.fullModelsGrid.innerHTML = "";
  state.models.forEach(m => {
    const isSelected = m.id === state.activeModel;
    const isBest = m.id === DEFAULT_CHAT_MODEL;

    const card = document.createElement("div");
    card.className = `model-card ${isSelected ? "active" : ""}`;
    card.innerHTML = `
      <div class="card-top">
        <div class="card-name-row">
          <span>${m.icon || "✨"}</span>
          <span class="card-m-name">${m.name}</span>
        </div>
        <span class="card-badge" style="background: ${isBest ? "linear-gradient(135deg, #10b981, #06b6d4)" : (m.color || "#8b5cf6")}">
          ${isBest ? "★ Fastest & Best Default" : (m.badge || "Free")}
        </span>
      </div>
      <div class="card-speed" style="font-size: 0.72rem; color: #10b981; font-weight: 700;">${m.speed || "100% Free"}</div>
      <div class="card-m-desc">${m.description || m.tagline}</div>
      <div style="font-size: 0.7rem; color: var(--text-faint); font-family: var(--font-mono);">${m.id}</div>
    `;
    card.addEventListener("click", () => selectModel(m.id));
    DOM.fullModelsGrid.appendChild(card);
  });
}

function renderEmbeddingsUI() {
  DOM.embeddingsGrid.innerHTML = "";
  state.embeddingModels.forEach(m => {
    const isSelected = m.id === state.activeEmbeddingModel;
    const isBest = m.id === DEFAULT_EMBEDDING_MODEL;

    const card = document.createElement("div");
    card.className = `model-card ${isSelected ? "active" : ""}`;
    card.innerHTML = `
      <div class="card-top">
        <span class="card-m-name">${m.name || m.id}</span>
        <span class="card-badge" style="background: ${isBest ? "linear-gradient(135deg, #10b981, #06b6d4)" : "#3b82f6"}">
          ${isBest ? "★ Best Default" : `${m.dimensions || 1536}d`}
        </span>
      </div>
      <div class="card-m-desc">${m.description || "Vector embedding representation model."}</div>
      <div style="font-size: 0.7rem; color: var(--text-faint); font-family: var(--font-mono);">${m.id}</div>
    `;
    card.addEventListener("click", () => selectEmbeddingModel(m.id));
    DOM.embeddingsGrid.appendChild(card);
  });
}

// ==========================================================
// USER PC SPECIAL FOLDER STORAGE (File System Access API & IndexedDB)
// ==========================================================
const IDB_NAME = "RoroGPT_Storage";
const IDB_STORE = "handles";

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandleToIDB(handle) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(handle, "chats_dir");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Failed to store dir handle in IDB", e);
  }
}

async function getDirHandleFromIDB() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("chats_dir");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function verifyPermission(fileHandle) {
  if (!fileHandle) return false;
  const options = { mode: "readwrite" };
  try {
    if ((await fileHandle.queryPermission(options)) === "granted") return true;
    if ((await fileHandle.requestPermission(options)) === "granted") return true;
  } catch {}
  return false;
}

function updatePCFolderUI(name, isConnected) {
  const dotClass = isConnected ? "pc-folder-dot connected" : "pc-folder-dot";
  const modalDotClass = isConnected ? "pc-storage-dot connected" : "pc-storage-dot";
  const displayName = name ? `📁 ${name}` : "No Folder Selected";

  if (DOM.pcFolderDot) DOM.pcFolderDot.className = dotClass;
  if (DOM.pcFolderName) DOM.pcFolderName.textContent = displayName;
  if (DOM.modalPcFolderDot) DOM.modalPcFolderDot.className = modalDotClass;
  if (DOM.modalPcFolderName) DOM.modalPcFolderName.textContent = displayName;
}

async function initPCFolder() {
  const storedHandle = await getDirHandleFromIDB();
  if (storedHandle) {
    state.dirHandle = storedHandle;
    const name = storedHandle.name || state.pcFolderName || "Connected Folder";
    state.pcFolderName = name;
    updatePCFolderUI(name, true);
  } else {
    updatePCFolderUI(state.pcFolderName, false);
  }
}

async function selectPCFolder() {
  if (!("showDirectoryPicker" in window)) {
    alert("Your browser does not support native Directory Picker. Please use Google Chrome, Microsoft Edge, Opera, or Brave to auto-save chats directly to your PC folder. You can also use the Export button to save chats anytime.");
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({
      id: "rorogpt_chats_folder",
      mode: "readwrite"
    });

    state.dirHandle = handle;
    state.pcFolderName = handle.name;
    localStorage.setItem("roro_pc_folder_name", handle.name);
    await saveDirHandleToIDB(handle);

    updatePCFolderUI(handle.name, true);
    showToast(`Connected PC Folder: ${handle.name}! Auto-saving all chats...`, "success");

    // Automatically sync all existing chats into the chosen folder
    await saveAllChatsToPC();
  } catch (err) {
    if (err.name !== "AbortError") {
      showToast(`Folder selection error: ${err.message}`, "error");
    }
  }
}

async function autoSaveChatToPC(chat) {
  if (!chat || !chat.id) return;
  if (!state.dirHandle) return;

  try {
    const hasPerm = await verifyPermission(state.dirHandle);
    if (!hasPerm) return;

    // 1. Format Human-Readable Markdown
    let md = `# ${chat.title}\n*Saved locally by RoroGPT on ${new Date().toLocaleString()}*\n*Model: ${chat.model || state.activeModel}*\n*Chat ID: ${chat.id}*\n\n---\n\n`;
    (chat.messages || []).forEach(m => {
      md += `### ${m.role === "user" ? "👤 User" : "🤖 RoroGPT"}\n\n`;
      if (m.reasoning) {
        md += `> **Thinking Process:**\n> ${m.reasoning.replace(/\n/g, "\n> ")}\n\n`;
      }
      md += `${m.content}\n\n`;
    });

    // 2. Format JSON representation
    const jsonStr = JSON.stringify(chat, null, 2);

    const safeTitle = (chat.title || "chat").replace(/[^a-z0-9_\- ]/gi, "_").trim().slice(0, 36);
    const baseName = `${safeTitle}_${chat.id}`;

    // Write Markdown file
    const mdFileHandle = await state.dirHandle.getFileHandle(`${baseName}.md`, { create: true });
    const mdWritable = await mdFileHandle.createWritable();
    await mdWritable.write(md);
    await mdWritable.close();

    // Write JSON file
    const jsonFileHandle = await state.dirHandle.getFileHandle(`${baseName}.json`, { create: true });
    const jsonWritable = await jsonFileHandle.createWritable();
    await jsonWritable.write(jsonStr);
    await jsonWritable.close();

    console.log(`[RoroGPT] Chat "${chat.title}" saved locally on PC.`);
  } catch (e) {
    console.warn("Failed auto-saving chat to PC folder:", e);
  }
}

async function saveAllChatsToPC() {
  if (!state.dirHandle) {
    await selectPCFolder();
    if (!state.dirHandle) return;
  }

  const chatList = Object.values(state.chats);
  if (chatList.length === 0) {
    showToast("No chats to save yet", "info");
    return;
  }

  let count = 0;
  for (const chat of chatList) {
    await autoSaveChatToPC(chat);
    count++;
  }

  showToast(`Successfully saved ${count} conversations to your PC folder!`, "success");
}

async function importChatsFromPC() {
  if (!state.dirHandle) {
    await selectPCFolder();
    if (!state.dirHandle) return;
  }

  try {
    const hasPerm = await verifyPermission(state.dirHandle);
    if (!hasPerm) return;

    let importedCount = 0;
    for await (const entry of state.dirHandle.values()) {
      if (entry.kind === "file" && entry.name.endsWith(".json")) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (parsed && parsed.id && Array.isArray(parsed.messages)) {
            state.chats[parsed.id] = parsed;
            importedCount++;
          }
        } catch {}
      }
    }

    if (importedCount > 0) {
      saveChatsToStorage();
      renderConversationsSidebar();
      showToast(`Imported ${importedCount} conversations from your PC!`, "success");
    } else {
      showToast("No .json chat files found in that folder.", "info");
    }
  } catch (err) {
    showToast(`Import failed: ${err.message}`, "error");
  }
}

// ==========================================================
// CONVERSATIONS MANAGEMENT (LocalStorage + PC Auto-Save)
// ==========================================================
function loadSavedChats() {
  try {
    const raw = localStorage.getItem("roro_chats");
    if (raw) {
      state.chats = JSON.parse(raw);
    }
  } catch {
    state.chats = {};
  }

  // Load last active chat or create a fresh one
  const lastActive = localStorage.getItem("roro_last_active_chat");
  if (lastActive && state.chats[lastActive]) {
    loadChat(lastActive);
  } else {
    createNewChat();
  }
}

function saveChatsToStorage() {
  localStorage.setItem("roro_chats", JSON.stringify(state.chats));
  if (state.currentChatId) {
    localStorage.setItem("roro_last_active_chat", state.currentChatId);
    // Auto-save this chat to PC folder if connected
    if (state.dirHandle && state.chats[state.currentChatId]) {
      autoSaveChatToPC(state.chats[state.currentChatId]);
    }
  }
  renderConversationsSidebar();
}

function createNewChat() {
  const chatId = "chat_" + Date.now();
  state.chats[chatId] = {
    id: chatId,
    title: "New Conversation",
    createdAt: Date.now(),
    model: state.activeModel,
    messages: []
  };
  state.currentChatId = chatId;
  saveChatsToStorage();
  loadChat(chatId);

  // Focus input
  DOM.chatInput.focus();
}

function loadChat(chatId) {
  if (!state.chats[chatId]) return;
  state.currentChatId = chatId;
  localStorage.setItem("roro_last_active_chat", chatId);

  const chat = state.chats[chatId];
  renderMessages(chat.messages);
  renderConversationsSidebar();

  // If mobile, auto-close sidebar
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove("open");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
  }
}

function deleteChat(chatId, e) {
  if (e) e.stopPropagation();
  if (confirm("Delete this conversation?")) {
    delete state.chats[chatId];
    if (state.currentChatId === chatId) {
      const remainingIds = Object.keys(state.chats);
      if (remainingIds.length > 0) {
        loadChat(remainingIds[0]);
      } else {
        createNewChat();
      }
    } else {
      saveChatsToStorage();
    }
    showToast("Chat deleted", "info");
  }
}

function renderConversationsSidebar() {
  const searchTerm = (DOM.searchChatsInput.value || "").toLowerCase().trim();
  DOM.conversationsList.innerHTML = "";

  const chatIds = Object.keys(state.chats).sort((a, b) => state.chats[b].createdAt - state.chats[a].createdAt);

  chatIds.forEach(id => {
    const chat = state.chats[id];
    if (searchTerm && !chat.title.toLowerCase().includes(searchTerm)) {
      return;
    }

    const isActive = id === state.currentChatId;
    const item = document.createElement("div");
    item.className = `chat-item ${isActive ? "active" : ""}`;
    item.innerHTML = `
      <span class="chat-item-title">${escapeHTML(chat.title)}</span>
      <div class="chat-item-actions">
        <button class="chat-action-btn delete-btn" title="Delete chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    item.addEventListener("click", () => loadChat(id));
    const delBtn = item.querySelector(".delete-btn");
    delBtn.addEventListener("click", (e) => deleteChat(id, e));

    DOM.conversationsList.appendChild(item);
  });
}

// ==========================================================
// RENDERING MESSAGES & CHAT UI
// ==========================================================
function renderMessages(messages) {
  DOM.messagesContainer.innerHTML = "";

  if (!messages || messages.length === 0) {
    DOM.welcomeScreen.style.display = "flex";
    return;
  }

  DOM.welcomeScreen.style.display = "none";
  messages.forEach((msg, idx) => {
    appendMessageElement(msg, idx);
  });

  scrollToBottom();
}

function appendMessageElement(msg, index) {
  const isUser = msg.role === "user";
  const row = document.createElement("div");
  row.className = `message-row ${isUser ? "user" : "bot"}`;
  row.setAttribute("data-index", index);

  const avatar = isUser ? "" : `
    <div class="avatar bot" title="RoroGPT">
      <img src="/logo.jpg" alt="RoroGPT Avatar">
    </div>
  `;

  // DeepSeek R1 / Reasoning collapsible content
  let reasoningHtml = "";
  if (!isUser && msg.reasoning) {
    reasoningHtml = `
      <div class="reasoning-box">
        <div class="reasoning-header">
          <span>💭 Thinking Process (${msg.reasoning.length} chars)</span>
          <span class="reason-toggle-icon">▼</span>
        </div>
        <div class="reasoning-content">${escapeHTML(msg.reasoning)}</div>
      </div>
    `;
  }

  const contentHtml = isUser ? escapeHTML(msg.content) : renderMarkdown(msg.content);

  row.innerHTML = `
    ${avatar}
    <div class="message-bubble-wrapper">
      <div class="message-bubble">
        ${reasoningHtml}
        <div class="bubble-text">${contentHtml}</div>
      </div>
      <div class="message-meta">
        ${isUser ? "" : `<span class="bot-model-tag" style="color: var(--accent-cyan); font-weight: 600;">${msg.model || "RoroGPT"}</span>`}
        <div class="message-actions">
          <button class="action-chip-btn copy-msg-btn" title="Copy message">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          ${!isUser ? `
            <button class="action-chip-btn speak-msg-btn" title="Read Aloud">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              <span>Speak</span>
            </button>
          ` : ""}
        </div>
      </div>
    </div>
  `;

  // Attach reasoning accordion toggle
  const reasonHeader = row.querySelector(".reasoning-header");
  if (reasonHeader) {
    reasonHeader.addEventListener("click", () => {
      const box = reasonHeader.closest(".reasoning-box");
      box.classList.toggle("collapsed");
      const icon = reasonHeader.querySelector(".reason-toggle-icon");
      icon.textContent = box.classList.contains("collapsed") ? "▶" : "▼";
    });
  }

  // Attach copy button
  const copyBtn = row.querySelector(".copy-msg-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const liveText = msg.content || row.querySelector(".bubble-text")?.innerText || "";
      navigator.clipboard.writeText(liveText).then(() => {
        copyBtn.querySelector("span").textContent = "Copied!";
        setTimeout(() => { copyBtn.querySelector("span").textContent = "Copy"; }, 1500);
      });
    });
  }

  // Attach speak button
  const speakBtn = row.querySelector(".speak-msg-btn");
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      const liveText = msg.content || row.querySelector(".bubble-text")?.innerText || "";
      speakText(liveText, speakBtn);
    });
  }

  DOM.messagesContainer.appendChild(row);
}

function scrollToBottom() {
  DOM.chatViewport.scrollTop = DOM.chatViewport.scrollHeight;
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, tag => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[tag] || tag));
}

// Text-to-Speech
function speakText(text, btn) {
  if (!("speechSynthesis" in window)) {
    showToast("Text-to-speech not supported in browser", "error");
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.querySelector("span").textContent = "Speak";
    return;
  }
  const clean = text.replace(/```[\s\S]*?```/g, "Code block omitted.").replace(/[#*`_]/g, "");
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.onend = () => { btn.querySelector("span").textContent = "Speak"; };
  btn.querySelector("span").textContent = "Stop";
  window.speechSynthesis.speak(utterance);
}

// ==========================================================
// SEND MESSAGE & STREAMING COMPLETION
// ==========================================================
async function sendMessage() {
  const text = DOM.chatInput.value.trim();
  if (!text || state.isGenerating) return;

  const currentChat = state.chats[state.currentChatId];
  if (!currentChat) return;

  // Add User Message
  const userMsg = { role: "user", content: text };
  currentChat.messages.push(userMsg);

  // Auto-generate title if first message
  if (currentChat.messages.length === 1) {
    currentChat.title = text.slice(0, 32) + (text.length > 32 ? "..." : "");
  }

  // Clear input
  DOM.chatInput.value = "";
  DOM.chatInput.style.height = "auto";
  DOM.sendBtn.disabled = true;

  // Render user message
  DOM.welcomeScreen.style.display = "none";
  appendMessageElement(userMsg, currentChat.messages.length - 1);
  scrollToBottom();
  sfx.playPop();

  // Create Bot Message container
  const botMsg = {
    role: "assistant",
    content: "",
    reasoning: "",
    model: state.activeModel
  };
  currentChat.messages.push(botMsg);
  const botIndex = currentChat.messages.length - 1;

  appendMessageElement(botMsg, botIndex);
  const botRow = DOM.messagesContainer.querySelector(`[data-index="${botIndex}"]`);
  const bubbleText = botRow.querySelector(".bubble-text");
  bubbleText.innerHTML = `<span class="pulsing-dot"></span>`;

  // Start Generation state
  state.isGenerating = true;
  DOM.generatingBar.style.display = "flex";
  state.abortController = new AbortController();

  const genText = DOM.generatingBar.querySelector(".gen-text");
  let elapsedSeconds = 0;
  if (genText) genText.textContent = "Connecting to free model...";
  const timerInterval = setInterval(() => {
    elapsedSeconds++;
    if (!genText) return;
    if (state.activeModel.includes("r1")) {
      genText.textContent = `DeepSeek R1 reasoning (${elapsedSeconds}s)... (Thinking models solve complex steps first)`;
    } else {
      genText.textContent = `RoroGPT is replying (${elapsedSeconds}s)...`;
    }
  }, 1000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: currentChat.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        model: state.activeModel,
        systemPrompt: state.systemPrompt,
        temperature: state.temperature,
        apiKey: state.apiKey
      }),
      signal: state.abortController.signal
    });

    if (!res.ok) {
      let errText = "Failed to generate reply";
      try {
        const errJson = await res.json();
        if (errJson?.error) errText = errJson.error;
      } catch {
        errText = await res.text();
      }
      throw new Error(errText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    let renderScheduled = false;
    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        bubbleText.innerHTML = renderMarkdown(botMsg.content);
        scrollToBottom();
      });
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("data: ")) {
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;

          try {
            const data = JSON.parse(payload);
            if (data.error) throw new Error(data.error);

            if (data.reasoning) {
              botMsg.reasoning += data.reasoning;
              updateReasoningBox(botRow, botMsg.reasoning);
            }

            if (data.content) {
              botMsg.content += data.content;
              scheduleRender();
            }
          } catch (e) {
            if (payload !== "[DONE]") {
              console.warn("SSE parse error", e);
            }
          }
        }
      }
    }

    // Final clean render to ensure complete formatting and syntax highlighting
    bubbleText.innerHTML = renderMarkdown(botMsg.content);
    scrollToBottom();

    sfx.playReceive();
  } catch (err) {
    if (err.name === "AbortError") {
      botMsg.content += "\n\n*(Generation stopped by user)*";
    } else {
      botMsg.content = `⚠️ **Error:** ${err.message}`;
      showToast(err.message, "error");
    }
    bubbleText.innerHTML = renderMarkdown(botMsg.content);
  } finally {
    clearInterval(timerInterval);
    state.isGenerating = false;
    DOM.generatingBar.style.display = "none";
    DOM.sendBtn.disabled = DOM.chatInput.value.trim().length === 0;
    saveChatsToStorage();
    scrollToBottom();
  }
}

function updateReasoningBox(row, reasoningText) {
  let box = row.querySelector(".reasoning-box");
  if (!box) {
    box = document.createElement("div");
    box.className = "reasoning-box";
    box.innerHTML = `
      <div class="reasoning-header">
        <span>💭 Thinking Process (${reasoningText.length} chars)</span>
        <span class="reason-toggle-icon">▼</span>
      </div>
      <div class="reasoning-content">${escapeHTML(reasoningText)}</div>
    `;
    const bubble = row.querySelector(".message-bubble");
    bubble.insertBefore(box, bubble.firstChild);

    box.querySelector(".reasoning-header").addEventListener("click", () => {
      box.classList.toggle("collapsed");
      box.querySelector(".reason-toggle-icon").textContent = box.classList.contains("collapsed") ? "▶" : "▼";
    });
  } else {
    box.querySelector(".reasoning-header span").textContent = `💭 Thinking Process (${reasoningText.length} chars)`;
    box.querySelector(".reasoning-content").textContent = reasoningText;
  }
}

// ==========================================================
// EMBEDDINGS TESTER & SIMILARITY
// ==========================================================
async function computeSimilarity() {
  const textA = DOM.embedTextA.value.trim();
  const textB = DOM.embedTextB.value.trim();

  if (!textA || !textB) {
    showToast("Please enter both Text A and Text B", "error");
    return;
  }

  DOM.computeSimilarityBtn.disabled = true;
  DOM.computeSimilarityBtn.textContent = "⏳ Computing Vectors...";

  try {
    const res = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: [textA, textB],
        model: state.activeEmbeddingModel,
        apiKey: state.apiKey
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Embeddings calculation failed");
    }

    const vecA = data.data[0].embedding;
    const vecB = data.data[1].embedding;
    const sim = cosineSimilarity(vecA, vecB);
    const pct = Math.max(0, Math.min(100, Math.round(sim * 100)));

    DOM.similarityResultCard.style.display = "flex";
    DOM.similarityPercentage.textContent = `${pct}% Match`;
    DOM.similarityMeterFill.style.width = `${pct}%`;
    DOM.embedMetaDetails.textContent = `Model: ${data.model} | Vector Dimensions: ${vecA.length} | Cosine: ${sim.toFixed(4)}`;
    showToast("Semantic similarity computed successfully!", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    DOM.computeSimilarityBtn.disabled = false;
    DOM.computeSimilarityBtn.textContent = "⚡ Compute Similarity with Active Embedding Model";
  }
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ==========================================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================================
function initEvents() {
  // Chat input auto-expand & send on Enter
  DOM.chatInput.addEventListener("input", () => {
    DOM.chatInput.style.height = "auto";
    DOM.chatInput.style.height = Math.min(DOM.chatInput.scrollHeight, 180) + "px";
    DOM.sendBtn.disabled = DOM.chatInput.value.trim().length === 0 || state.isGenerating;
  });

  DOM.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  DOM.sendBtn.addEventListener("click", sendMessage);

  // Stop generation
  DOM.stopGenerationBtn.addEventListener("click", () => {
    if (state.abortController) {
      state.abortController.abort();
    }
  });

  // Delegated Code Copy Handler
  DOM.messagesContainer.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".copy-code-btn");
    if (!copyBtn) return;
    const wrapper = copyBtn.closest(".code-block-wrapper");
    const codeEl = wrapper ? wrapper.querySelector("pre code") : null;
    if (!codeEl) return;

    navigator.clipboard.writeText(codeEl.innerText).then(() => {
      copyBtn.innerHTML = `<span>✓ Copied!</span>`;
      copyBtn.style.color = "#10b981";
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        `;
        copyBtn.style.color = "";
      }, 1800);
    }).catch(() => {
      showToast("Unable to copy code", "error");
    });
  });

  // New Chat
  DOM.newChatBtn.addEventListener("click", createNewChat);

  // Search chats
  DOM.searchChatsInput.addEventListener("input", renderConversationsSidebar);

  // Sidebar toggle & backdrop (Instant appear / disappear)
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  DOM.menuToggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      DOM.sidebar.classList.toggle("open");
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.toggle("active", DOM.sidebar.classList.contains("open"));
      }
    } else {
      DOM.sidebar.classList.toggle("hidden");
    }
  });
  DOM.closeSidebarBtn.addEventListener("click", () => {
    DOM.sidebar.classList.remove("open");
    DOM.sidebar.classList.add("hidden");
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.remove("active");
    }
  });
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      DOM.sidebar.classList.remove("open");
      sidebarBackdrop.classList.remove("active");
    });
  }

  // Starter prompt cards
  document.querySelectorAll(".prompt-card").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      DOM.chatInput.value = prompt;
      DOM.chatInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });

  // Model pill dropdown toggle
  DOM.modelPillBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.modelPillContainer.classList.toggle("open");
  });
  DOM.inputModelChip.addEventListener("click", () => {
    DOM.modelPillContainer.classList.add("open");
  });
  document.addEventListener("click", (e) => {
    if (!DOM.modelPillContainer.contains(e.target)) {
      DOM.modelPillContainer.classList.remove("open");
    }
    if (!DOM.themeDropdownContainer.contains(e.target)) {
      DOM.themeDropdownContainer.classList.remove("open");
    }
  });

  // Theme dropdown toggle
  DOM.themePickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.themeDropdownContainer.classList.toggle("open");
  });
  DOM.themeOpts.forEach(btn => {
    btn.addEventListener("click", () => {
      setTheme(btn.getAttribute("data-theme"));
      DOM.themeDropdownContainer.classList.remove("open");
    });
  });

  // Sound SFX toggle
  DOM.sfxToggleBtn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem("roro_sfx", state.soundEnabled);
    DOM.sfxToggleBtn.style.color = state.soundEnabled ? "var(--text-main)" : "var(--text-faint)";
    showToast(`Sound FX ${state.soundEnabled ? "Enabled" : "Disabled"}`);
  });

  // Modals open/close
  DOM.openSettingsBtn.addEventListener("click", openSettingsModal);
  DOM.openEmbeddingsBtn.addEventListener("click", () => DOM.embeddingsModal.classList.add("open"));
  DOM.openCustomModelModal.addEventListener("click", () => {
    DOM.modelPillContainer.classList.remove("open");
    DOM.embeddingsModal.classList.add("open");
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      document.getElementById(modalId).classList.remove("open");
    });
  });

  // Settings Save
  DOM.saveSettingsBtn.addEventListener("click", () => {
    state.apiKey = DOM.apiKeyInput.value.trim();
    state.systemPrompt = DOM.systemPromptInput.value.trim();
    state.temperature = parseFloat(DOM.temperatureSlider.value);

    localStorage.setItem("roro_api_key", state.apiKey);
    localStorage.setItem("roro_system_prompt", state.systemPrompt);
    localStorage.setItem("roro_temperature", state.temperature);

    updateApiKeyBadge(false);
    DOM.settingsModal.classList.remove("open");
    showToast("Settings saved successfully!", "success");
  });

  // API Key visibility toggle
  DOM.toggleApiKeyVisibility.addEventListener("click", () => {
    const isPass = DOM.apiKeyInput.type === "password";
    DOM.apiKeyInput.type = isPass ? "text" : "password";
    DOM.toggleApiKeyVisibility.textContent = isPass ? "🔒" : "👁️";
  });

  // Temperature slider display
  DOM.temperatureSlider.addEventListener("input", () => {
    DOM.temperatureValue.textContent = DOM.temperatureSlider.value;
  });

  // System Prompt presets
  document.querySelectorAll(".preset-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      DOM.systemPromptInput.value = tag.getAttribute("data-prompt");
    });
  });

  // Modal Studio Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.getAttribute("data-tab"));
      if (target) target.classList.add("active");
    });
  });

  // Custom Chat Model
  DOM.applyCustomModelBtn.addEventListener("click", () => {
    const custom = DOM.customModelInput.value.trim();
    if (custom) {
      selectModel(custom);
      DOM.embeddingsModal.classList.remove("open");
    }
  });

  // Custom Embedding Model
  DOM.applyCustomEmbeddingBtn.addEventListener("click", () => {
    const custom = DOM.customEmbeddingModelInput.value.trim();
    if (custom) {
      selectEmbeddingModel(custom);
    }
  });

  // Compute Similarity in Tester
  DOM.computeSimilarityBtn.addEventListener("click", computeSimilarity);

  // Clear Chat
  DOM.clearChatBtn.addEventListener("click", () => {
    if (confirm("Clear all messages in this conversation?")) {
      const current = state.chats[state.currentChatId];
      if (current) {
        current.messages = [];
        saveChatsToStorage();
        renderMessages([]);
      }
    }
  });

  // Export Chat
  DOM.exportChatBtn.addEventListener("click", exportConversation);

  // User PC Local Storage Folder
  if (DOM.selectPcFolderBtn) DOM.selectPcFolderBtn.addEventListener("click", selectPCFolder);
  if (DOM.modalSelectFolderBtn) DOM.modalSelectFolderBtn.addEventListener("click", selectPCFolder);
  if (DOM.modalSyncNowBtn) DOM.modalSyncNowBtn.addEventListener("click", saveAllChatsToPC);
  if (DOM.modalLoadFromPcBtn) DOM.modalLoadFromPcBtn.addEventListener("click", importChatsFromPC);
}

function openSettingsModal() {
  DOM.apiKeyInput.value = state.apiKey;
  DOM.systemPromptInput.value = state.systemPrompt;
  DOM.temperatureSlider.value = state.temperature;
  DOM.temperatureValue.textContent = state.temperature;
  DOM.settingsModal.classList.add("open");
}

function exportConversation() {
  const current = state.chats[state.currentChatId];
  if (!current || current.messages.length === 0) {
    showToast("No messages to export", "info");
    return;
  }
  let md = `# ${current.title}\n*Exported from RoroGPT on ${new Date().toLocaleString()}*\n*Model: ${current.model || state.activeModel}*\n\n---\n\n`;
  current.messages.forEach(m => {
    md += `### ${m.role === "user" ? "👤 You" : "🤖 RoroGPT"}\n\n${m.content}\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${current.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Conversation exported as Markdown", "success");
}

// ==========================================================
// STARTUP
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  setTheme(state.currentTheme);
  setupMarkdown();
  initEvents();
  initPCFolder();
  fetchModels();
  loadSavedChats();
});
