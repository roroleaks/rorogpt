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

// Theme default: Clean Daylight on start
const savedTheme = localStorage.getItem("roro_theme");
const defaultMigrated = localStorage.getItem("roro_theme_default_clean_light_v1");
let initialTheme = "clean-light";
if (!defaultMigrated) {
  initialTheme = "clean-light";
  localStorage.setItem("roro_theme_default_clean_light_v1", "true");
  localStorage.setItem("roro_theme", "clean-light");
} else if (savedTheme && savedTheme !== "candy-pop") {
  initialTheme = savedTheme;
}

// State
const state = {
  activeModel: initialModel,
  activeEmbeddingModel: localStorage.getItem("roro_active_embed_model") || DEFAULT_EMBEDDING_MODEL,
  apiKey: localStorage.getItem("roro_api_key") || "",
  systemPrompt: localStorage.getItem("roro_system_prompt") || "",
  temperature: parseFloat(localStorage.getItem("roro_temperature") || "0.7"),
  currentTheme: initialTheme,
  soundEnabled: localStorage.getItem("roro_sfx") !== "false",
  currentChatId: null,
  chats: {},
  models: [],
  embeddingModels: [],
  isGenerating: false,
  abortController: null,
  // PC Local Storage
  dirHandle: null,
  pcFolderName: localStorage.getItem("roro_pc_folder_name") || "",
  // Attachments & Personal Library
  attachments: [],
  activeSkill: null,
  skills: [],
  libraryItems: [],
  activeLibFilter: "all",
  cameraStream: null,
  capturedPhotoData: null,
  previewPendingItem: null
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
  modalLoadFromPcBtn: document.getElementById("modalLoadFromPcBtn"),
  // Attachments Menu & Tray
  attachMenuContainer: document.getElementById("attachMenuContainer"),
  attachMenuBtn: document.getElementById("attachMenuBtn"),
  attachMenuPopup: document.getElementById("attachMenuPopup"),
  actionUploadFiles: document.getElementById("actionUploadFiles"),
  actionUploadPhotos: document.getElementById("actionUploadPhotos"),
  actionAddSkill: document.getElementById("actionAddSkill"),
  actionTakePhoto: document.getElementById("actionTakePhoto"),
  actionAddWebLink: document.getElementById("actionAddWebLink"),
  actionOpenLibrary: document.getElementById("actionOpenLibrary"),
  attachmentsTray: document.getElementById("attachmentsTray"),
  filePickerInput: document.getElementById("filePickerInput"),
  photoPickerInput: document.getElementById("photoPickerInput"),
  skillImportInput: document.getElementById("skillImportInput"),
  activeSkillComposerChip: document.getElementById("activeSkillComposerChip"),
  activeSkillComposerName: document.getElementById("activeSkillComposerName"),
  clearActiveSkillBtn: document.getElementById("clearActiveSkillBtn"),
  openLibraryBtn: document.getElementById("openLibraryBtn"),
  // Camera Modal
  cameraModal: document.getElementById("cameraModal"),
  cameraVideo: document.getElementById("cameraVideo"),
  cameraCanvas: document.getElementById("cameraCanvas"),
  cameraSnapshotPreview: document.getElementById("cameraSnapshotPreview"),
  cameraErrorBanner: document.getElementById("cameraErrorBanner"),
  cameraLiveControls: document.getElementById("cameraLiveControls"),
  cameraReviewControls: document.getElementById("cameraReviewControls"),
  capturePhotoBtn: document.getElementById("capturePhotoBtn"),
  retakePhotoBtn: document.getElementById("retakePhotoBtn"),
  usePhotoBtn: document.getElementById("usePhotoBtn"),
  // Web Link Modal
  webLinkModal: document.getElementById("webLinkModal"),
  webLinkUrlInput: document.getElementById("webLinkUrlInput"),
  webLinkInstructionInput: document.getElementById("webLinkInstructionInput"),
  webLinkStatusBox: document.getElementById("webLinkStatusBox"),
  fetchAndAttachUrlBtn: document.getElementById("fetchAndAttachUrlBtn"),
  // Skills Modal
  skillModal: document.getElementById("skillModal"),
  tabSavedSkills: document.getElementById("tabSavedSkills"),
  tabNewSkill: document.getElementById("tabNewSkill"),
  contentSavedSkills: document.getElementById("contentSavedSkills"),
  contentNewSkill: document.getElementById("contentNewSkill"),
  savedSkillsCount: document.getElementById("savedSkillsCount"),
  skillsListContainer: document.getElementById("skillsListContainer"),
  skillImportDropzone: document.getElementById("skillImportDropzone"),
  browseSkillFileBtn: document.getElementById("browseSkillFileBtn"),
  newSkillNameInput: document.getElementById("newSkillNameInput"),
  newSkillDescInput: document.getElementById("newSkillDescInput"),
  newSkillInstructionsInput: document.getElementById("newSkillInstructionsInput"),
  saveNewSkillBtn: document.getElementById("saveNewSkillBtn"),
  // Personal Library Modal
  libraryModal: document.getElementById("libraryModal"),
  librarySearchInput: document.getElementById("librarySearchInput"),
  libraryFilterPills: document.getElementById("libraryFilterPills"),
  libraryGridContainer: document.getElementById("libraryGridContainer"),
  librarySyncDot: document.getElementById("librarySyncDot"),
  librarySyncText: document.getElementById("librarySyncText"),
  librarySyncPcBtn: document.getElementById("librarySyncPcBtn"),
  libCountAll: document.getElementById("libCountAll"),
  libCountDocs: document.getElementById("libCountDocs"),
  libCountPhotos: document.getElementById("libCountPhotos"),
  libCountSkills: document.getElementById("libCountSkills"),
  libCountLinks: document.getElementById("libCountLinks"),
  // Preview Modal
  itemPreviewModal: document.getElementById("itemPreviewModal"),
  previewModalIcon: document.getElementById("previewModalIcon"),
  previewModalTitle: document.getElementById("previewModalTitle"),
  previewModalBody: document.getElementById("previewModalBody"),
  previewAttachToChatBtn: document.getElementById("previewAttachToChatBtn")
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
const IDB_STORE_LIB = "library_items";
const IDB_STORE_SKILLS = "skills";

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
      if (!db.objectStoreNames.contains(IDB_STORE_LIB)) db.createObjectStore(IDB_STORE_LIB, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_STORE_SKILLS)) db.createObjectStore(IDB_STORE_SKILLS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, item) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`IDB Put error in ${storeName}`, e);
  }
}

async function idbGetAll(storeName) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbDelete(storeName, key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`IDB Delete error in ${storeName}`, e);
  }
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
// UNIVERSAL ATTACHMENTS, CAMERA, WEBLINKS, SKILLS & PERSONAL LIBRARY
// ==========================================================

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// ----------------------------------------------------------
// Attachment Tray in Composer
// ----------------------------------------------------------
function renderAttachmentsTray() {
  if (!DOM.attachmentsTray) return;
  if (state.attachments.length === 0) {
    DOM.attachmentsTray.style.display = "none";
    DOM.attachmentsTray.innerHTML = "";
    if (DOM.sendBtn) {
      DOM.sendBtn.disabled = DOM.chatInput.value.trim().length === 0 || state.isGenerating;
    }
    return;
  }

  DOM.attachmentsTray.style.display = "flex";
  DOM.attachmentsTray.innerHTML = "";

  state.attachments.forEach(att => {
    const chip = document.createElement("div");
    chip.className = `attachment-chip ${att.type}`;
    chip.setAttribute("data-id", att.id);

    let visual = "";
    if (att.type === "image" && (att.previewUrl || att.base64Data)) {
      visual = `<img src="${att.previewUrl || att.base64Data}" class="chip-thumbnail" alt="${escapeHTML(att.name)}">`;
    } else {
      const icon = att.type === "weblink" ? "🔗" : att.type === "skill" ? "⚡" : "📄";
      visual = `<span class="chip-icon">${icon}</span>`;
    }

    chip.innerHTML = `
      ${visual}
      <div class="chip-info">
        <span class="chip-name" title="${escapeHTML(att.name)}">${escapeHTML(att.name)}</span>
        <span class="chip-meta">${escapeHTML(att.meta || "")}</span>
      </div>
      <div class="chip-actions">
        <button class="chip-btn chip-save-btn" title="Save to Personal Library" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        </button>
        <button class="chip-btn chip-remove-btn" title="Remove attachment" type="button">&times;</button>
      </div>
    `;

    chip.querySelector(".chip-remove-btn").addEventListener("click", () => {
      removeAttachment(att.id);
    });

    chip.querySelector(".chip-save-btn").addEventListener("click", () => {
      saveAttachmentToLibrary(att.id);
    });

    DOM.attachmentsTray.appendChild(chip);
  });

  if (DOM.sendBtn) {
    DOM.sendBtn.disabled = state.isGenerating;
  }
}

function removeAttachment(id) {
  state.attachments = state.attachments.filter(a => a.id !== id);
  renderAttachmentsTray();
}

async function saveAttachmentToLibrary(id) {
  const att = state.attachments.find(a => a.id === id);
  if (!att) return;
  const libItem = {
    ...att,
    id: "lib_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    savedAt: Date.now()
  };
  await idbPut(IDB_STORE_LIB, libItem);
  await loadLibrary();
  showToast(`Saved "${att.name}" to Personal Library!`, "success");
}

// ----------------------------------------------------------
// Document Parsing (PDF.js, Mammoth DOCX, Code/Text)
// ----------------------------------------------------------
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

async function handleDocumentFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    if (file.size > 25 * 1024 * 1024) {
      showToast(`File "${file.name}" exceeds 25MB limit.`, "error");
      continue;
    }

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        handlePhotoFiles([file]);
        continue;
      }
      let extractedText = "";
      let pageCount = null;

      if (ext === "pdf") {
        if (!window.pdfjsLib) {
          throw new Error("PDF parser library not loaded.");
        }
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages;
        let pagesText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStr = content.items.map(item => item.str).join(" ");
          pagesText.push(`[Page ${i} of ${pdf.numPages}]\n${pageStr}`);
        }
        extractedText = pagesText.join("\n\n");
      } else if (ext === "docx" || ext === "doc") {
        if (!window.mammoth) {
          throw new Error("DOCX parser library not loaded.");
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else {
        // Plain text, Markdown, CSV, JSON, code files (.js, .py, .ts, etc.)
        extractedText = await file.text();
      }

      if (!extractedText.trim()) {
        showToast(`Document "${file.name}" appears to be empty or unscannable.`, "info");
      }

      // Check for content limit (120,000 characters to avoid silent truncation)
      let isTruncated = false;
      if (extractedText.length > 120000) {
        extractedText = extractedText.slice(0, 120000) + "\n\n[...Document truncated to first 120,000 characters to fit model context window...]";
        isTruncated = true;
      }

      const metaParts = [formatBytes(file.size)];
      if (pageCount) metaParts.push(`${pageCount} pages`);
      if (isTruncated) metaParts.push("Truncated");

      const attachment = {
        id: "att_doc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        type: "document",
        name: file.name,
        size: file.size,
        mimeType: file.type || "text/plain",
        textContent: extractedText,
        meta: metaParts.join(" • "),
        createdAt: Date.now()
      };

      state.attachments.push(attachment);
      renderAttachmentsTray();
      showToast(`Attached document "${file.name}"!`, "success");
    } catch (err) {
      showToast(`Failed to parse "${file.name}": ${err.message}`, "error");
    }
  }
}

// ----------------------------------------------------------
// Photos & Images
// ----------------------------------------------------------
function handlePhotoFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    if (file.size > 12 * 1024 * 1024) {
      showToast(`Image "${file.name}" exceeds 12MB limit.`, "error");
      continue;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const attachment = {
        id: "att_img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        type: "image",
        name: file.name,
        size: file.size,
        mimeType: file.type || "image/jpeg",
        previewUrl: dataUrl,
        base64Data: dataUrl,
        meta: formatBytes(file.size),
        createdAt: Date.now()
      };
      state.attachments.push(attachment);
      renderAttachmentsTray();
      showToast(`Attached photo "${file.name}"!`, "success");
    };
    reader.onerror = () => {
      showToast(`Could not read "${file.name}".`, "error");
    };
    reader.readAsDataURL(file);
  }
}

// ----------------------------------------------------------
// Camera Capture (getUserMedia)
// ----------------------------------------------------------
async function openCameraModal() {
  if (DOM.cameraErrorBanner) DOM.cameraErrorBanner.style.display = "none";
  if (DOM.cameraSnapshotPreview) DOM.cameraSnapshotPreview.style.display = "none";
  if (DOM.cameraVideo) DOM.cameraVideo.style.display = "block";
  if (DOM.cameraLiveControls) DOM.cameraLiveControls.style.display = "flex";
  if (DOM.cameraReviewControls) DOM.cameraReviewControls.style.display = "none";
  state.capturedPhotoData = null;

  DOM.cameraModal.classList.add("open");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (DOM.cameraErrorBanner) {
      DOM.cameraErrorBanner.style.display = "block";
      DOM.cameraErrorBanner.innerHTML = "Camera API is not supported in this browser. Please use <strong>Upload photos</strong> instead.";
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    state.cameraStream = stream;
    DOM.cameraVideo.srcObject = stream;
  } catch (err) {
    if (DOM.cameraErrorBanner) {
      DOM.cameraErrorBanner.style.display = "block";
      DOM.cameraErrorBanner.innerHTML = `Camera access error: ${escapeHTML(err.message)}.<br>Please allow camera permissions or use <strong>Upload photos</strong>.`;
    }
  }
}

function closeCameraModal() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
  if (DOM.cameraVideo) DOM.cameraVideo.srcObject = null;
  DOM.cameraModal.classList.remove("open");
}

function captureCameraPhoto() {
  if (!DOM.cameraVideo || !DOM.cameraCanvas) return;
  const video = DOM.cameraVideo;
  const canvas = DOM.cameraCanvas;
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  state.capturedPhotoData = dataUrl;

  DOM.cameraSnapshotPreview.src = dataUrl;
  DOM.cameraSnapshotPreview.style.display = "block";
  DOM.cameraVideo.style.display = "none";

  DOM.cameraLiveControls.style.display = "none";
  DOM.cameraReviewControls.style.display = "flex";
}

function retakeCameraPhoto() {
  state.capturedPhotoData = null;
  DOM.cameraSnapshotPreview.style.display = "none";
  DOM.cameraVideo.style.display = "block";
  DOM.cameraLiveControls.style.display = "flex";
  DOM.cameraReviewControls.style.display = "none";
}

function useCapturedPhoto() {
  if (!state.capturedPhotoData) return;
  const timestamp = new Date().toLocaleTimeString().replace(/:/g, "-");
  const fileName = `Camera_Photo_${timestamp}.jpg`;
  const estimatedSize = Math.round((state.capturedPhotoData.length * 3) / 4);

  const attachment = {
    id: "att_cam_" + Date.now(),
    type: "image",
    name: fileName,
    size: estimatedSize,
    mimeType: "image/jpeg",
    previewUrl: state.capturedPhotoData,
    base64Data: state.capturedPhotoData,
    meta: formatBytes(estimatedSize),
    createdAt: Date.now()
  };

  state.attachments.push(attachment);
  renderAttachmentsTray();
  closeCameraModal();
  showToast("Photo captured and attached!", "success");
}

// ----------------------------------------------------------
// Website Link (Safe Retrieval Endpoint)
// ----------------------------------------------------------
async function fetchAndAttachWebLink() {
  const url = (DOM.webLinkUrlInput.value || "").trim();
  const instruction = (DOM.webLinkInstructionInput.value || "").trim();

  if (!url) {
    showToast("Please enter a valid website URL", "error");
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    showToast("URL must start with http:// or https://", "error");
    return;
  }

  DOM.webLinkStatusBox.style.display = "block";
  DOM.webLinkStatusBox.className = "weblink-status-box loading";
  DOM.webLinkStatusBox.innerHTML = `<span class="pulsing-dot"></span> <span>Fetching and analyzing webpage content safely...</span>`;
  DOM.fetchAndAttachUrlBtn.disabled = true;

  try {
    const res = await fetch("/api/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Web content retrieval failed");
    }

    DOM.webLinkStatusBox.className = "weblink-status-box success";
    DOM.webLinkStatusBox.innerHTML = `✅ Successfully extracted "<strong>${escapeHTML(data.title)}</strong>" (${data.content.length} chars).`;

    let siteHostname = "";
    try {
      siteHostname = new URL(url).hostname;
    } catch {
      siteHostname = url;
    }

    const attachment = {
      id: "att_url_" + Date.now(),
      type: "weblink",
      name: data.title || siteHostname,
      url: url,
      instruction: instruction,
      textContent: data.content,
      summary: data.description || "",
      siteName: data.siteName || siteHostname,
      meta: `Web Link • ${data.siteName || siteHostname}`,
      createdAt: Date.now()
    };

    state.attachments.push(attachment);
    renderAttachmentsTray();

    showToast(`Website "${attachment.name}" attached!`, "success");
    setTimeout(() => {
      DOM.webLinkModal.classList.remove("open");
      DOM.webLinkUrlInput.value = "";
      DOM.webLinkInstructionInput.value = "";
      DOM.webLinkStatusBox.style.display = "none";
    }, 600);
  } catch (err) {
    DOM.webLinkStatusBox.className = "weblink-status-box error";
    DOM.webLinkStatusBox.innerHTML = `⚠️ ${escapeHTML(err.message)}`;
    showToast(err.message, "error");
  } finally {
    DOM.fetchAndAttachUrlBtn.disabled = false;
  }
}

// ----------------------------------------------------------
// Skills Management (Reusable AI Instructions)
// ----------------------------------------------------------
const DEFAULT_SKILLS = [
  {
    id: "skill_fullstack_architect",
    name: "Fullstack Code Architect",
    description: "Enforces production-grade, bug-free code with explicit types, error handling, and modern architecture.",
    instructions: "You are a Principal Fullstack Software Engineer. Produce production-grade, robust, and clean code. Enforce type safety, structured modular design, comprehensive error handling, and provide concise rationale for key technical decisions.",
    createdAt: Date.now()
  },
  {
    id: "skill_concise_explainer",
    name: "Concise Technical Explainer",
    description: "High-signal, zero-fluff explanations with sharp bullet points and working minimal code examples.",
    instructions: "You are an ultra-concise technical educator. Omit all conversational fluff, pleasantries, and boilerplate. Provide direct, high-signal explanations structured with sharp bullet points and practical code examples.",
    createdAt: Date.now()
  },
  {
    id: "skill_clinical_synthesizer",
    name: "Scientific & Clinical Synthesizer",
    description: "Evidence-based academic synthesis, structured critique, methodology analysis, and citation formatting.",
    instructions: "Adopt an objective, evidence-based academic research persona. Synthesize scientific evidence, highlight methodology, ground claims systematically, critically assess limitations, and provide structured, peer-review-grade commentary.",
    createdAt: Date.now()
  }
];

async function initSkills() {
  const stored = await idbGetAll(IDB_STORE_SKILLS);
  if (!stored || stored.length === 0) {
    for (const sk of DEFAULT_SKILLS) {
      await idbPut(IDB_STORE_SKILLS, sk);
    }
    state.skills = [...DEFAULT_SKILLS];
  } else {
    state.skills = stored;
  }
  renderSkillsList();
}

function renderSkillsList() {
  if (!DOM.skillsListContainer) return;
  DOM.skillsListContainer.innerHTML = "";
  if (DOM.savedSkillsCount) DOM.savedSkillsCount.textContent = state.skills.length;

  if (state.skills.length === 0) {
    DOM.skillsListContainer.innerHTML = `<div class="empty-hint" style="padding:20px; text-align:center; color:var(--text-muted);">No skills created yet. Use the "Create or Import Skill" tab above to add reusable AI instructions!</div>`;
    return;
  }

  state.skills.forEach(skill => {
    const isActive = state.activeSkill && state.activeSkill.id === skill.id;
    const card = document.createElement("div");
    card.className = `skill-card ${isActive ? "active" : ""}`;
    card.innerHTML = `
      <div class="skill-card-main">
        <div class="skill-card-header">
          <span class="skill-card-title">${escapeHTML(skill.name)}</span>
          ${isActive ? `<span class="skill-active-badge">Active in Chat</span>` : ""}
        </div>
        <div class="skill-card-desc">${escapeHTML(skill.description || "Custom AI instructions")}</div>
      </div>
      <div class="skill-card-actions">
        <button class="btn btn-sm ${isActive ? "btn-secondary" : "btn-primary"} skill-toggle-btn">
          ${isActive ? "Deactivate" : "⚡ Activate"}
        </button>
        <button class="btn btn-sm btn-secondary skill-preview-btn" title="View Instructions">👁️ Preview</button>
        <button class="icon-btn skill-delete-btn" title="Delete skill" style="color:var(--text-faint);">&times;</button>
      </div>
    `;

    card.querySelector(".skill-toggle-btn").addEventListener("click", () => {
      if (isActive) {
        deactivateSkill();
      } else {
        activateSkill(skill);
      }
    });

    card.querySelector(".skill-preview-btn").addEventListener("click", () => {
      openPreviewModal("⚡", skill.name, `<pre style="white-space:pre-wrap; font-family:var(--font-mono); font-size:0.85rem;">${escapeHTML(skill.instructions)}</pre>`, skill);
    });

    card.querySelector(".skill-delete-btn").addEventListener("click", async () => {
      if (confirm(`Delete skill "${skill.name}"?`)) {
        await idbDelete(IDB_STORE_SKILLS, skill.id);
        if (state.activeSkill && state.activeSkill.id === skill.id) {
          deactivateSkill();
        }
        await initSkills();
        showToast("Skill deleted", "info");
      }
    });

    DOM.skillsListContainer.appendChild(card);
  });
}

function activateSkill(skill) {
  state.activeSkill = skill;
  if (DOM.activeSkillComposerChip) {
    DOM.activeSkillComposerChip.style.display = "inline-flex";
    DOM.activeSkillComposerName.textContent = skill.name;
  }
  DOM.skillModal.classList.remove("open");
  renderSkillsList();
  showToast(`Activated skill: "${skill.name}"! Applied to upcoming chat responses.`, "success");
}

function deactivateSkill() {
  state.activeSkill = null;
  if (DOM.activeSkillComposerChip) {
    DOM.activeSkillComposerChip.style.display = "none";
  }
  renderSkillsList();
  showToast("Skill deactivated.", "info");
}

async function handleSkillFileInput(file) {
  if (!file) return;

  try {
    let name = file.name.replace(/\.[^/.]+$/, "");
    let description = "";
    let instructions = "";

    if (file.name.endsWith(".zip")) {
      if (!window.JSZip) throw new Error("JSZip library not loaded");
      const zip = await JSZip.loadAsync(file);
      let skillFile = zip.file("SKILL.md") || zip.file("skill.md");
      if (!skillFile) {
        // Find any .md file
        const mdFiles = Object.keys(zip.files).filter(k => k.endsWith(".md"));
        if (mdFiles.length > 0) skillFile = zip.file(mdFiles[0]);
      }
      if (!skillFile) throw new Error("Could not find SKILL.md inside the ZIP archive.");
      const text = await skillFile.async("text");
      const parsed = parseSkillText(text, name);
      name = parsed.name || name;
      description = parsed.description || "";
      instructions = parsed.instructions;
    } else {
      const text = await file.text();
      const parsed = parseSkillText(text, name);
      name = parsed.name || name;
      description = parsed.description || "";
      instructions = parsed.instructions;
    }

    DOM.newSkillNameInput.value = name;
    DOM.newSkillDescInput.value = description;
    DOM.newSkillInstructionsInput.value = instructions;

    // Switch to create tab
    DOM.tabNewSkill.click();
    showToast(`Parsed skill "${name}". Review and click Save!`, "info");
  } catch (err) {
    showToast(`Failed to parse skill: ${err.message}`, "error");
  }
}

function parseSkillText(text, fallbackName) {
  let name = fallbackName;
  let description = "";
  let instructions = text;

  // Frontmatter check: --- name: ... description: ... ---
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    const yaml = fmMatch[1];
    instructions = fmMatch[2].trim();
    const nameMatch = yaml.match(/name:\s*["']?([^"'\n\r]+)["']?/i);
    if (nameMatch) name = nameMatch[1].trim();
    const descMatch = yaml.match(/description:\s*["']?([^"'\n\r]+)["']?/i);
    if (descMatch) description = descMatch[1].trim();
  } else {
    // Heading check: # Name
    const h1Match = text.match(/^#\s+(.+)$/m);
    if (h1Match) name = h1Match[1].trim();
  }

  return { name, description, instructions: instructions.trim() };
}

async function saveCustomSkill() {
  const name = DOM.newSkillNameInput.value.trim();
  const desc = DOM.newSkillDescInput.value.trim();
  const inst = DOM.newSkillInstructionsInput.value.trim();

  if (!name || !inst) {
    showToast("Please provide both a Skill Name and Instructions.", "error");
    return;
  }

  const newSkill = {
    id: "skill_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    name: name,
    description: desc || "Custom instruction set",
    instructions: inst,
    createdAt: Date.now()
  };

  await idbPut(IDB_STORE_SKILLS, newSkill);
  await initSkills();

  // Reset form & switch to list tab
  DOM.newSkillNameInput.value = "";
  DOM.newSkillDescInput.value = "";
  DOM.newSkillInstructionsInput.value = "";
  DOM.tabSavedSkills.click();

  showToast(`Skill "${name}" saved to library!`, "success");
}

// ----------------------------------------------------------
// Personal Library (Local-First Persistence & PC Sync)
// ----------------------------------------------------------
async function loadLibrary() {
  const items = await idbGetAll(IDB_STORE_LIB);
  state.libraryItems = items || [];

  const counts = {
    all: state.libraryItems.length,
    document: 0,
    image: 0,
    skill: 0,
    weblink: 0
  };

  state.libraryItems.forEach(i => {
    if (counts[i.type] !== undefined) counts[i.type]++;
  });

  if (DOM.libCountAll) DOM.libCountAll.textContent = counts.all;
  if (DOM.libCountDocs) DOM.libCountDocs.textContent = counts.document;
  if (DOM.libCountPhotos) DOM.libCountPhotos.textContent = counts.image;
  if (DOM.libCountSkills) DOM.libCountSkills.textContent = counts.skill;
  if (DOM.libCountLinks) DOM.libCountLinks.textContent = counts.weblink;

  if (DOM.librarySyncText) {
    DOM.librarySyncText.textContent = state.dirHandle
      ? `📁 PC Folder Linked: ${state.pcFolderName}`
      : "Local Browser Storage (IndexedDB • 100% Private)";
  }

  renderLibraryGrid();
}

function renderLibraryGrid() {
  if (!DOM.libraryGridContainer) return;
  DOM.libraryGridContainer.innerHTML = "";

  const query = (DOM.librarySearchInput.value || "").toLowerCase().trim();
  const filter = state.activeLibFilter || "all";

  const filtered = state.libraryItems.filter(item => {
    if (filter !== "all" && item.type !== filter) return false;
    if (query) {
      const matchName = item.name && item.name.toLowerCase().includes(query);
      const matchDesc = item.textContent && item.textContent.toLowerCase().includes(query);
      const matchMeta = item.meta && item.meta.toLowerCase().includes(query);
      if (!matchName && !matchDesc && !matchMeta) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    DOM.libraryGridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">📚</div>
        <p style="font-weight: 600; margin-bottom: 4px;">No library items found</p>
        <span style="font-size: 0.8rem;">Attach documents, photos, links, or skills in the composer and click the 💾 save icon to store them here permanently!</span>
      </div>
    `;
    return;
  }

  filtered.sort((a, b) => (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0));

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "lib-card";

    let visual = "";
    if (item.type === "image" && (item.previewUrl || item.base64Data)) {
      visual = `<img src="${item.previewUrl || item.base64Data}" class="lib-card-img-thumb" alt="${escapeHTML(item.name)}">`;
    } else {
      const icon = item.type === "weblink" ? "🔗" : item.type === "skill" ? "⚡" : "📄";
      visual = `<span class="lib-card-icon">${icon}</span>`;
    }

    card.innerHTML = `
      <div class="lib-card-top">
        ${visual}
        <div class="lib-card-title-box">
          <span class="lib-card-title" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
          <span class="lib-card-meta">${escapeHTML(item.meta || item.type)}</span>
        </div>
      </div>
      <div class="lib-card-actions">
        <button class="btn btn-sm btn-primary lib-attach-btn" title="Add to current chat">➕ Attach</button>
        <button class="btn btn-sm btn-secondary lib-preview-btn" title="Preview item">👁️ View</button>
        <button class="icon-btn lib-delete-btn" title="Delete from Library" style="color:var(--text-faint);">&times;</button>
      </div>
    `;

    card.querySelector(".lib-attach-btn").addEventListener("click", () => {
      attachLibraryItemToChat(item);
    });

    card.querySelector(".lib-preview-btn").addEventListener("click", () => {
      previewLibraryItem(item);
    });

    card.querySelector(".lib-delete-btn").addEventListener("click", async () => {
      if (confirm(`Remove "${item.name}" from your Personal Library?`)) {
        await idbDelete(IDB_STORE_LIB, item.id);
        await loadLibrary();
        showToast("Item removed from library", "info");
      }
    });

    DOM.libraryGridContainer.appendChild(card);
  });
}

function attachLibraryItemToChat(item) {
  // Clone item with fresh attachment ID
  const attachment = {
    ...item,
    id: "att_lib_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4)
  };
  state.attachments.push(attachment);
  renderAttachmentsTray();
  DOM.libraryModal.classList.remove("open");
  showToast(`Attached "${item.name}" from Library!`, "success");
}

function previewLibraryItem(item) {
  let contentHtml = "";
  if (item.type === "image") {
    contentHtml = `<div style="text-align:center;"><img src="${item.previewUrl || item.base64Data}" style="max-width:100%; max-height:480px; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.3);"></div>`;
  } else if (item.textContent) {
    contentHtml = `<pre style="white-space:pre-wrap; font-family:var(--font-mono); font-size:0.84rem;">${escapeHTML(item.textContent)}</pre>`;
  } else if (item.instructions) {
    contentHtml = `<pre style="white-space:pre-wrap; font-family:var(--font-mono); font-size:0.84rem;">${escapeHTML(item.instructions)}</pre>`;
  } else {
    contentHtml = `<p>${escapeHTML(item.summary || "No preview content available.")}</p>`;
  }

  const icon = item.type === "image" ? "🖼️" : item.type === "weblink" ? "🔗" : item.type === "skill" ? "⚡" : "📄";
  openPreviewModal(icon, item.name, contentHtml, item);
}

function openPreviewModal(icon, title, bodyHtml, itemToAttach = null) {
  DOM.previewModalIcon.textContent = icon;
  DOM.previewModalTitle.textContent = title;
  DOM.previewModalBody.innerHTML = bodyHtml;
  state.previewPendingItem = itemToAttach;

  if (itemToAttach) {
    DOM.previewAttachToChatBtn.style.display = "inline-block";
  } else {
    DOM.previewAttachToChatBtn.style.display = "none";
  }

  DOM.itemPreviewModal.classList.add("open");
}

async function syncLibraryToPCFolder() {
  if (!state.dirHandle) {
    await selectPCFolder();
    if (!state.dirHandle) return;
  }

  try {
    const hasPerm = await verifyPermission(state.dirHandle);
    if (!hasPerm) {
      showToast("Storage permission not granted for PC folder.", "error");
      return;
    }

    const libFolder = await state.dirHandle.getDirectoryHandle("Library", { create: true });
    let count = 0;

    for (const item of state.libraryItems) {
      const safeTitle = (item.name || "item").replace(/[^a-z0-9_\-\.]/gi, "_").slice(0, 40);

      if (item.type === "image" && item.base64Data) {
        // Convert base64 to Blob
        const parts = item.base64Data.split(";base64,");
        const contentType = parts[0].replace("data:", "") || "image/jpeg";
        const byteCharacters = atob(parts[1] || "");
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: contentType });
        const ext = contentType.includes("png") ? "png" : "jpg";
        const fileHandle = await libFolder.getFileHandle(`${safeTitle}.${ext}`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        count++;
      } else {
        const textToSave = item.textContent || item.instructions || item.url || "";
        const ext = item.type === "skill" ? "md" : "txt";
        const fileHandle = await libFolder.getFileHandle(`${safeTitle}.${ext}`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(textToSave);
        await writable.close();
        count++;
      }
    }

    showToast(`Successfully synced ${count} items to your PC folder (Library/)!`, "success");
  } catch (err) {
    showToast(`PC Sync failed: ${err.message}`, "error");
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

  // Render attachment chips or image previews in user message bubble
  let attachmentsHtml = "";
  if (isUser && msg.attachments && msg.attachments.length > 0) {
    let chips = "";
    msg.attachments.forEach(att => {
      if (att.type === "image" && (att.previewUrl || att.base64Data)) {
        chips += `<img src="${att.previewUrl || att.base64Data}" class="msg-attached-img" alt="${escapeHTML(att.name)}" title="${escapeHTML(att.name)}" data-preview="true">`;
      } else {
        const icon = att.type === "weblink" ? "🔗" : att.type === "skill" ? "⚡" : "📄";
        chips += `<span class="msg-attachment-badge"><span>${icon}</span><span>${escapeHTML(att.name)}</span></span>`;
      }
    });
    attachmentsHtml = `<div class="msg-attachments-container">${chips}</div>`;
  }

  // User text or display text
  let userText = "";
  if (typeof msg.content === "string") {
    userText = msg.displayContent || msg.content;
  } else if (Array.isArray(msg.content)) {
    const textPart = msg.content.find(p => p.type === "text");
    userText = msg.displayContent || (textPart ? textPart.text : "");
  }

  const contentHtml = isUser ? escapeHTML(userText) : renderMarkdown(msg.content);

  row.innerHTML = `
    ${avatar}
    <div class="message-bubble-wrapper">
      <div class="message-bubble">
        ${attachmentsHtml}
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

  // Attach click listener on user message attached images to preview full-screen
  row.querySelectorAll(".msg-attached-img").forEach(img => {
    img.addEventListener("click", () => {
      openPreviewModal("🖼️ Photo", img.title || "Photo", `<div style="text-align:center;"><img src="${img.src}" style="max-width:100%; border-radius:8px;"></div>`);
    });
  });

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
  const hasAttachments = state.attachments.length > 0;
  if ((!text && !hasAttachments) || state.isGenerating) return;

  const currentChat = state.chats[state.currentChatId];
  if (!currentChat) return;

  // Check if photos/images are attached
  const photoAttachments = state.attachments.filter(a => a.type === "image");
  if (photoAttachments.length > 0) {
    const activeModelObj = state.models.find(m => m.id === state.activeModel);
    const supportsVision = activeModelObj ? !!activeModelObj.supportsVision : (state.activeModel.includes("gemini") || state.activeModel.includes("vision"));

    if (!supportsVision) {
      const switchVision = confirm(
        `The active model (${state.activeModel}) does not support image analysis.\n\nWould you like to switch to Gemini 2.0 Flash (Fast & Vision Capable) to analyze your ${photoAttachments.length} image(s)?`
      );
      if (switchVision) {
        selectModel("gemini-2.0-flash");
      } else {
        showToast("Please switch to a vision model (e.g. Gemini 2.0 Flash) or remove images.", "warning");
        return;
      }
    }
  }

  // Build combined text with document & weblink context
  let contextDocs = "";
  const docAttachments = state.attachments.filter(a => a.type === "document");
  if (docAttachments.length > 0) {
    contextDocs += "--- [ATTACHED DOCUMENTS] ---\n";
    docAttachments.forEach(d => {
      contextDocs += `\n[Document: ${d.name}]\n${d.textContent}\n`;
    });
  }

  const linkAttachments = state.attachments.filter(a => a.type === "weblink");
  if (linkAttachments.length > 0) {
    contextDocs += "\n--- [ATTACHED WEBSITES] ---\n";
    linkAttachments.forEach(l => {
      contextDocs += `\n[URL: ${l.url}]\n${l.instruction ? `Instruction: ${l.instruction}\n` : ""}Content:\n${l.textContent}\n`;
    });
  }

  const promptText = (contextDocs ? contextDocs + "\n\n--- [USER QUESTION] ---\n" : "") + (text || "Please review and process the attached files.");

  // Multimodal structure if images are attached
  let userMessageContent = promptText;
  if (photoAttachments.length > 0) {
    userMessageContent = [
      { type: "text", text: promptText },
      ...photoAttachments.map(img => ({
        type: "image_url",
        image_url: { url: img.base64Data }
      }))
    ];
  }

  const attachmentsSnapshot = [...state.attachments];

  // Add User Message
  const userMsg = {
    role: "user",
    content: userMessageContent,
    displayContent: text || `[Attached ${attachmentsSnapshot.length} file(s)]`,
    attachments: attachmentsSnapshot
  };
  currentChat.messages.push(userMsg);

  // Auto-generate title if first message
  if (currentChat.messages.length === 1) {
    const titleBase = text || attachmentsSnapshot[0]?.name || "New Conversation";
    currentChat.title = titleBase.slice(0, 32) + (titleBase.length > 32 ? "..." : "");
  }

  // Clear input & attachments
  DOM.chatInput.value = "";
  DOM.chatInput.style.height = "auto";
  state.attachments = [];
  renderAttachmentsTray();
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
        skillPrompt: state.activeSkill ? state.activeSkill.instructions : "",
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
    DOM.sendBtn.disabled = DOM.chatInput.value.trim().length === 0 && state.attachments.length === 0;
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
    DOM.sendBtn.disabled = (DOM.chatInput.value.trim().length === 0 && state.attachments.length === 0) || state.isGenerating;
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

  // PC Local Storage Folder
  if (DOM.selectPcFolderBtn) DOM.selectPcFolderBtn.addEventListener("click", selectPCFolder);
  if (DOM.modalSelectFolderBtn) DOM.modalSelectFolderBtn.addEventListener("click", selectPCFolder);
  if (DOM.modalSyncNowBtn) DOM.modalSyncNowBtn.addEventListener("click", saveAllChatsToPC);
  if (DOM.modalLoadFromPcBtn) DOM.modalLoadFromPcBtn.addEventListener("click", importChatsFromPC);

  // ==========================================================
  // ATTACHMENTS & "+" MENU EVENT LISTENERS
  // ==========================================================

  function closeAttachMenu() {
    if (DOM.attachMenuContainer) DOM.attachMenuContainer.classList.remove("open");
    if (DOM.attachMenuPopup) DOM.attachMenuPopup.classList.remove("open");
    if (DOM.attachMenuBtn) DOM.attachMenuBtn.setAttribute("aria-expanded", "false");
  }

  function toggleAttachMenu() {
    if (!DOM.attachMenuContainer || !DOM.attachMenuPopup) return;
    const isCurrentlyOpen = DOM.attachMenuContainer.classList.contains("open") || DOM.attachMenuPopup.classList.contains("open");
    if (isCurrentlyOpen) {
      closeAttachMenu();
    } else {
      DOM.attachMenuContainer.classList.add("open");
      DOM.attachMenuPopup.classList.add("open");
      if (DOM.attachMenuBtn) DOM.attachMenuBtn.setAttribute("aria-expanded", "true");
    }
  }

  // "+" Attachment Menu Toggle
  if (DOM.attachMenuBtn) {
    DOM.attachMenuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAttachMenu();
    });
  }

  // Close menus on outside click or Escape key
  document.addEventListener("click", (e) => {
    if (DOM.attachMenuContainer && !DOM.attachMenuContainer.contains(e.target)) {
      closeAttachMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAttachMenu();
      if (state.cameraStream) {
        closeCameraModal();
      }
    }
  });

  // Action 1: Upload Files
  if (DOM.actionUploadFiles) {
    DOM.actionUploadFiles.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      if (DOM.filePickerInput) DOM.filePickerInput.click();
    });
  }
  if (DOM.filePickerInput) {
    DOM.filePickerInput.addEventListener("change", (e) => {
      handleDocumentFiles(e.target.files);
      e.target.value = "";
    });
  }

  // Action 2: Upload Photos
  if (DOM.actionUploadPhotos) {
    DOM.actionUploadPhotos.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      if (DOM.photoPickerInput) DOM.photoPickerInput.click();
    });
  }
  if (DOM.photoPickerInput) {
    DOM.photoPickerInput.addEventListener("change", (e) => {
      handlePhotoFiles(e.target.files);
      e.target.value = "";
    });
  }

  // Action 3: Add a Skill
  if (DOM.actionAddSkill) {
    DOM.actionAddSkill.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      if (DOM.skillModal) DOM.skillModal.classList.add("open");
    });
  }

  // Action 4: Take a Photo
  if (DOM.actionTakePhoto) {
    DOM.actionTakePhoto.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      openCameraModal();
    });
  }

  // Action 5: Add a Website Link
  if (DOM.actionAddWebLink) {
    DOM.actionAddWebLink.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      if (DOM.webLinkStatusBox) DOM.webLinkStatusBox.style.display = "none";
      if (DOM.webLinkModal) DOM.webLinkModal.classList.add("open");
    });
  }

  // Action 6 & Sidebar: Personal Library
  if (DOM.actionOpenLibrary) {
    DOM.actionOpenLibrary.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      loadLibrary();
      if (DOM.libraryModal) DOM.libraryModal.classList.add("open");
    });
  }
  if (DOM.openLibraryBtn) {
    DOM.openLibraryBtn.addEventListener("click", () => {
      loadLibrary();
      DOM.libraryModal.classList.add("open");
    });
  }

  // Clear Active Skill Composer Chip
  if (DOM.clearActiveSkillBtn) {
    DOM.clearActiveSkillBtn.addEventListener("click", deactivateSkill);
  }

  // Camera Controls
  if (DOM.capturePhotoBtn) DOM.capturePhotoBtn.addEventListener("click", captureCameraPhoto);
  if (DOM.retakePhotoBtn) DOM.retakePhotoBtn.addEventListener("click", retakeCameraPhoto);
  if (DOM.usePhotoBtn) DOM.usePhotoBtn.addEventListener("click", useCapturedPhoto);

  // Close Camera tracks when modal close button clicked
  document.querySelectorAll('[data-close="cameraModal"]').forEach(btn => {
    btn.addEventListener("click", closeCameraModal);
  });

  // Website Link Fetch
  if (DOM.fetchAndAttachUrlBtn) {
    DOM.fetchAndAttachUrlBtn.addEventListener("click", fetchAndAttachWebLink);
  }

  // Skills Tabs
  if (DOM.tabSavedSkills && DOM.tabNewSkill) {
    DOM.tabSavedSkills.addEventListener("click", () => {
      DOM.tabSavedSkills.classList.add("active");
      DOM.tabNewSkill.classList.remove("active");
      DOM.contentSavedSkills.style.display = "block";
      DOM.contentNewSkill.style.display = "none";
      renderSkillsList();
    });

    DOM.tabNewSkill.addEventListener("click", () => {
      DOM.tabNewSkill.classList.add("active");
      DOM.tabSavedSkills.classList.remove("active");
      DOM.contentNewSkill.style.display = "block";
      DOM.contentSavedSkills.style.display = "none";
    });
  }

  // Skill File Import & Dropzone
  if (DOM.browseSkillFileBtn) {
    DOM.browseSkillFileBtn.addEventListener("click", () => {
      DOM.skillImportInput.click();
    });
  }
  if (DOM.skillImportInput) {
    DOM.skillImportInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSkillFileInput(e.target.files[0]);
      }
      e.target.value = "";
    });
  }
  if (DOM.skillImportDropzone) {
    DOM.skillImportDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      DOM.skillImportDropzone.classList.add("dragover");
    });
    DOM.skillImportDropzone.addEventListener("dragleave", () => {
      DOM.skillImportDropzone.classList.remove("dragover");
    });
    DOM.skillImportDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      DOM.skillImportDropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSkillFileInput(e.dataTransfer.files[0]);
      }
    });
  }

  // Save Custom Skill
  if (DOM.saveNewSkillBtn) {
    DOM.saveNewSkillBtn.addEventListener("click", saveCustomSkill);
  }

  // Personal Library Search & Filters
  if (DOM.librarySearchInput) {
    DOM.librarySearchInput.addEventListener("input", renderLibraryGrid);
  }

  if (DOM.libraryFilterPills) {
    DOM.libraryFilterPills.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        DOM.libraryFilterPills.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        state.activeLibFilter = pill.getAttribute("data-filter") || "all";
        renderLibraryGrid();
      });
    });
  }

  if (DOM.librarySyncPcBtn) {
    DOM.librarySyncPcBtn.addEventListener("click", syncLibraryToPCFolder);
  }

  // Preview Modal Attach to Chat
  if (DOM.previewAttachToChatBtn) {
    DOM.previewAttachToChatBtn.addEventListener("click", () => {
      if (state.previewPendingItem) {
        attachLibraryItemToChat(state.previewPendingItem);
        DOM.itemPreviewModal.classList.remove("open");
      }
    });
  }
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
  initSkills();
  loadLibrary();
  fetchModels();
  loadSavedChats();
});
