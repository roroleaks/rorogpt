/**
 * 🌈 ROROGPT - Modern, Colorful Free AI Chat Web App
 * Powered by 100% Free AI Models (Groq, Gemini, Cerebras, Local Ollama) & Vercel
 */

// Default Configuration: Free-Tier Provider Model by Default (Groq Qwen 3.8 27B)
const DEFAULT_CHAT_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_EMBEDDING_MODEL = "free-fast-vector";

function inferProvider(modelId) {
  if (!modelId) return "groq";
  if (modelId.startsWith("ollama/")) return "ollama";
  if (modelId.startsWith("cerebras/")) return "cerebras";
  if (modelId.startsWith("gemini-")) return "gemini";
  return "groq";
}

let initialModel = localStorage.getItem("roro_active_model");
if (!initialModel || initialModel.includes(":free") || initialModel.includes("openrouter") || initialModel.includes("meta-llama/")) {
  initialModel = DEFAULT_CHAT_MODEL;
  localStorage.setItem("roro_active_model", DEFAULT_CHAT_MODEL);
}

let initialProvider = localStorage.getItem("roro_active_provider") || inferProvider(initialModel);
if (initialProvider === "openrouter" || initialProvider === "local") {
  initialProvider = inferProvider(initialModel);
  localStorage.setItem("roro_active_provider", initialProvider);
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
  activeProvider: initialProvider,
  activeEmbeddingModel: localStorage.getItem("roro_active_embed_model") || DEFAULT_EMBEDDING_MODEL,
  apiKey: localStorage.getItem("roro_api_key") || "",
  appToken: localStorage.getItem("roro_app_token") || "",
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
  previewPendingItem: null,
  storageHealth: "healthy"
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
  appTokenInput: document.getElementById("appTokenInput"),
  toggleAppTokenVisibility: document.getElementById("toggleAppTokenVisibility"),
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
  // Storage & Persistence Health
  storageHealthBadge: document.getElementById("storageHealthBadge"),
  storageIndicatorDot: document.getElementById("storageIndicatorDot"),
  storageUsageText: document.getElementById("storageUsageText"),
  cleanOrphanBlobsBtn: document.getElementById("cleanOrphanBlobsBtn"),
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
// SAFE HTML ESCAPING & DOMPURIFY SANITIZATION (HIGH FIX 4)
// ==========================================================
function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, tag => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[tag] || tag));
}

// ==========================================================
// SECURITY HELPERS (HIGH FIX 5)
// ==========================================================

/**
 * Normalizes error messages: strips credential leaks, removes stack traces, and bounds length.
 */
function normalizeErrorMessage(input, maxLength = 300) {
  if (!input) return "An unexpected error occurred.";
  let msg = typeof input === "string" ? input : (input.message || String(input));

  // Redact potential authorization header tokens or API keys
  msg = msg.replace(/(?:bearer\s+|key=|token=|apikey=|secret=)[a-zA-Z0-9_\-\.]{12,}/gi, "[REDACTED_CREDENTIAL]");

  // Strip V8 / browser stack trace paths (both newline and inline patterns)
  if (msg.includes("\n    at ")) {
    msg = msg.split("\n    at ")[0].trim();
  } else if (msg.includes("\n  at ")) {
    msg = msg.split("\n  at ")[0].trim();
  } else if (msg.includes("\n at ")) {
    msg = msg.split("\n at ")[0].trim();
  }
  msg = msg.replace(/\s+at\s+[a-zA-Z0-9_$.<>]+\s+\([^)]+\)/g, "").trim();

  // Bound length to prevent DOM memory bloat or UI DOS
  if (msg.length > maxLength) {
    msg = msg.slice(0, maxLength) + "... (truncated)";
  }
  return msg;
}

/**
 * Validates whether a URL is strictly safe for navigation or image rendering.
 */
function isSafeUrl(url, allowDataImage = false) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  if (lower.startsWith("blob:")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "blob:" && !lower.includes("javascript:") && !lower.includes("vbscript:");
    } catch {
      return false;
    }
  }

  if (allowDataImage && lower.startsWith("data:image/")) {
    return /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(trimmed);
  }

  return false;
}

/**
 * Strict CSS color validator preventing arbitrary CSS property or expression injection.
 */
function isSafeCssColor(color) {
  if (!color || typeof color !== "string") return false;
  const trimmed = color.trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return true;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i.test(trimmed)) return true;
  if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i.test(trimmed)) return true;
  const SAFE_NAMED = new Set([
    "transparent", "currentcolor", "inherit",
    "black", "white", "gray", "red", "blue", "green", "purple", "cyan", "teal", "orange", "yellow"
  ]);
  if (SAFE_NAMED.has(trimmed.toLowerCase())) return true;
  if (/^linear-gradient\(\s*(?:\d+deg|to\s+[a-z\s]+)\s*,\s*#[0-9a-f]{3,8}\s*,\s*#[0-9a-f]{3,8}\s*\)$/i.test(trimmed)) return true;
  return false;
}

function inferProvider(modelId) {
  if (!modelId) return "groq";
  if (modelId.startsWith("ollama/")) return "ollama";
  if (modelId.startsWith("cerebras/")) return "cerebras";
  if (modelId.startsWith("gemini-")) return "gemini";
  return "groq";
}

// ==========================================================
// TOAST NOTIFICATIONS (SAFE DOM CONSTRUCTION - H5)
// ==========================================================
function showToast(message, type = "info") {
  const safeType = ["success", "error", "info", "warning"].includes(type) ? type : "info";
  const toast = document.createElement("div");
  toast.className = `toast ${safeType}`;

  const iconSpan = document.createElement("span");
  iconSpan.textContent = safeType === "success" ? "✅" : safeType === "error" ? "⚠️" : "ℹ️";

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-msg";
  msgSpan.textContent = normalizeErrorMessage(message);

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

let isPurifyConfigured = false;
function setupSanitizer() {
  if (!window.DOMPurify || isPurifyConfigured) return;
  isPurifyConfigured = true;

  try {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      // 1. Enforce safe links: only allow http:, https:, relative # or /
      if (node.tagName === "A") {
        const href = node.getAttribute("href");
        if (href) {
          const trimmed = href.trim();
          const lower = trimmed.toLowerCase();
          if (
            lower.startsWith("javascript:") ||
            lower.startsWith("vbscript:") ||
            lower.startsWith("data:") ||
            lower.startsWith("file:")
          ) {
            node.removeAttribute("href");
          } else if (
            lower.startsWith("http://") ||
            lower.startsWith("https://") ||
            lower.startsWith("#") ||
            lower.startsWith("/")
          ) {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          } else {
            node.removeAttribute("href");
          }
        }
      }

      // 2. Enforce safe image sources: restrict to http:, https:, or safe data:image/
      if (node.tagName === "IMG") {
        const src = node.getAttribute("src");
        if (src) {
          const lower = src.trim().toLowerCase();
          if (
            !lower.startsWith("http://") &&
            !lower.startsWith("https://") &&
            !lower.startsWith("data:image/")
          ) {
            node.removeAttribute("src");
          }
        }
      }

      // 3. Prevent CSS-based script or exfiltration vectors through inline style
      if (node.hasAttribute("style")) {
        const style = node.getAttribute("style");
        if (/url\(|expression\(|@import|-moz-binding|behavior/i.test(style)) {
          node.removeAttribute("style");
        }
      }

      // 4. Strip any lingering inline event handler attributes
      for (const attr of Array.from(node.attributes || [])) {
        if (attr.name.toLowerCase().startsWith("on")) {
          node.removeAttribute(attr.name);
        }
      }
    });
  } catch (err) {
    console.warn("Error setting up DOMPurify hooks", err);
  }
}

/**
 * Universal HTML Sanitizer boundary for all model outputs, imported chats, and previews.
 */
function sanitizeRenderedHtml(dirtyHtml) {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  if (window.DOMPurify) {
    setupSanitizer();
    try {
      return DOMPurify.sanitize(dirtyHtml, {
        USE_PROFILES: { html: true, mathMl: true, svg: true },
        FORBID_TAGS: [
          "script", "iframe", "object", "embed", "base", "form",
          "input", "textarea", "button", "select", "style", "link",
          "meta", "frame", "frameset", "applet"
        ],
        FORBID_ATTR: [
          "onerror", "onload", "onclick", "onmouseover", "onfocus",
          "onblur", "onchange", "onsubmit", "onreset", "onkeydown",
          "onkeypress", "onkeyup", "ondblclick", "oncontextmenu"
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ["target", "rel"]
      });
    } catch (err) {
      console.warn("DOMPurify execution failed, falling back to escaped text", err);
      return escapeHTML(dirtyHtml);
    }
  }

  // Safe Fallback: If DOMPurify is unavailable, NEVER output raw HTML
  console.warn("DOMPurify is unavailable. Rendering escaped plain text for safety.");
  return escapeHTML(dirtyHtml);
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
        return escapeHTML(code);
      }
    });
  }
}

// Render Markdown safely with Code Copy wrapper & DOMPurify Boundary
function renderMarkdown(rawText) {
  if (!rawText) return "";
  const text = typeof rawText === "string"
    ? rawText
    : (Array.isArray(rawText) ? rawText.map(p => (p && typeof p === "object" ? p.text || "" : String(p))).join("") : String(rawText));

  let html = "";
  if (window.marked) {
    try {
      html = marked.parse(text);
    } catch (err) {
      console.warn("Marked parse error", err);
      html = escapeHTML(text);
    }
  } else {
    html = escapeHTML(text);
  }

  // Render LaTeX math formulas if KaTeX is loaded
  if (window.katex) {
    // Display Math $$ ... $$
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return `<div class="katex-display">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return escapeHTML(match);
      }
    });
    // Inline Math $ ... $
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return escapeHTML(match);
      }
    });
  }

  // Sanitize the resulting HTML through DOMPurify boundary BEFORE attaching to DOM
  const cleanHtml = sanitizeRenderedHtml(html);

  // Wrap <pre><code> with colorful header & copy button
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = cleanHtml;

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

    const langSpan = document.createElement("span");
    langSpan.className = "code-lang";
    langSpan.textContent = `💻 ${(lang || "code").toUpperCase()}`;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-code-btn";
    copyBtn.title = "Copy code";
    copyBtn.type = "button";

    const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    copySvg.setAttribute("width", "12");
    copySvg.setAttribute("height", "12");
    copySvg.setAttribute("viewBox", "0 0 24 24");
    copySvg.setAttribute("fill", "none");
    copySvg.setAttribute("stroke", "currentColor");
    copySvg.setAttribute("stroke-width", "2");

    const copyRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    copyRect.setAttribute("x", "9");
    copyRect.setAttribute("y", "9");
    copyRect.setAttribute("width", "13");
    copyRect.setAttribute("height", "13");
    copyRect.setAttribute("rx", "2");
    copyRect.setAttribute("ry", "2");

    const copyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    copyPath.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    copySvg.appendChild(copyRect);
    copySvg.appendChild(copyPath);

    const copyLabel = document.createElement("span");
    copyLabel.textContent = "Copy";

    copyBtn.appendChild(copySvg);
    copyBtn.appendChild(copyLabel);

    header.appendChild(langSpan);
    header.appendChild(copyBtn);

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
    // Fallback model list (Free-tier models: Groq, Gemini, Cerebras, Ollama)
    state.models = [
      {
        id: "qwen/qwen3.8-27b",
        name: "Qwen 3.8 27B (Groq)",
        provider: "groq",
        speed: "⚡ Ultra-Fast (~0.2s)",
        badge: "Fast & Capable",
        color: "#10b981",
        icon: "🚀",
        description: "Alibaba's 27B model on Groq LPUs. Available on Groq developer free tier."
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash (Google)",
        provider: "gemini",
        speed: "⚡ Instant (~0.3s)",
        badge: "Multimodal",
        color: "#3b82f6",
        icon: "✨",
        description: "Next-gen multimodal model from Google AI Studio free tier."
      },
      {
        id: "cerebras/llama3.1-70b",
        name: "Llama 3.1 70B (Cerebras)",
        provider: "cerebras",
        speed: "⚡ Blazing (~1800 tok/s)",
        badge: "Speed King",
        color: "#8b5cf6",
        icon: "⚡",
        description: "Ultra-fast Llama 3.1 70B on Cerebras CS-3. Available on Cerebras free tier."
      },
      {
        id: "ollama/llama3.2",
        name: "Llama 3.2 3B (Local Ollama)",
        provider: "ollama",
        speed: "💻 Local CPU/GPU",
        badge: "100% Offline",
        color: "#06b6d4",
        icon: "🦙",
        description: "Runs completely locally on your hardware. Zero API keys required."
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
  if (!DOM.apiKeyStatusBadge) return;
  const k = (state.apiKey || "").trim();
  const hasUserKey = k.length > 5;
  const dot = DOM.apiKeyStatusBadge.querySelector(".status-dot");
  const text = DOM.apiKeyStatusBadge.querySelector(".status-text");
  if (!dot || !text) return;

  if (k.startsWith("sk-or-")) {
    dot.className = "status-dot";
    text.textContent = "⚠️ OpenRouter Unsupported";
    DOM.apiKeyStatusBadge.title = "OpenRouter is not supported. Use Groq (gsk_), Gemini (AIza), Cerebras (csk-), or Local Ollama.";
  } else if (k.startsWith("gsk_")) {
    dot.className = "status-dot active";
    text.textContent = "⚡ Groq Free Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Groq Developer Free Tier";
  } else if (k.startsWith("AIza")) {
    dot.className = "status-dot active";
    text.textContent = "🌟 Gemini Free Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Google AI Studio Free Tier";
  } else if (k.startsWith("csk-")) {
    dot.className = "status-dot active";
    text.textContent = "⚡ Cerebras Key Active";
    DOM.apiKeyStatusBadge.title = "Connected to Cerebras Cloud Free Tier";
  } else if (state.activeProvider === "ollama" || (state.activeModel && state.activeModel.startsWith("ollama/"))) {
    dot.className = "status-dot active";
    text.textContent = "💻 Local Ollama (Offline)";
    DOM.apiKeyStatusBadge.title = "Connected to Local Ollama (Zero API keys required)";
  } else if (hasUserKey) {
    dot.className = "status-dot active";
    text.textContent = "Custom Key Active";
  } else if (hasServerKey) {
    dot.className = "status-dot active";
    text.textContent = "Server Key Connected";
  } else {
    dot.className = "status-dot";
    text.textContent = "No Free Key Set";
    DOM.apiKeyStatusBadge.title = "Click Settings to paste your free Groq, Gemini, or Cerebras key, or use Local Ollama";
  }
}

function selectModel(modelId, provider) {
  if (!isAllowedModel(modelId)) {
    console.warn(`[RoroGPT] Rejected invalid or uncataloged model: ${modelId}`);
    showToast(`Model "${modelId || 'unknown'}" is not supported or not available in the free catalog.`, "error");
    return false;
  }

  const resolveModelProvider = (id) => {
    if (typeof inferProvider === "function") return inferProvider(id);
    if (!id) return "groq";
    if (id.startsWith("ollama/")) return "ollama";
    if (id.startsWith("cerebras/")) return "cerebras";
    if (id.startsWith("gemini-")) return "gemini";
    return "groq";
  };

  const modelObj = (state.models || []).find(m => m.id === modelId) || {
    id: modelId,
    name: (modelId || "").split("/").pop().replace(":free", ""),
    provider: provider || resolveModelProvider(modelId),
    speed: "⚡ Free Tier",
    color: "#10b981"
  };

  const resolvedProvider = provider || modelObj.provider || resolveModelProvider(modelId);

  // 1. Update global active model and provider
  state.activeModel = modelId;
  state.activeProvider = resolvedProvider;
  try {
    localStorage.setItem("roro_active_model", modelId);
    localStorage.setItem("roro_active_provider", resolvedProvider);
  } catch {}

  // 2. Update current active chat metadata without mutating historical assistant turns
  if (state.currentChatId && state.chats[state.currentChatId]) {
    state.chats[state.currentChatId].model = modelId;
    state.chats[state.currentChatId].provider = resolvedProvider;
    saveChatsToStorage();
  }

  // 3. Update all UI representations consistently
  updateActiveModelUI(modelId, resolvedProvider);

  if (modelId.includes("r1")) {
    showToast(`DeepSeek R1 selected. Note: Generates deep reasoning before answering (~30-90s). Switch to Gemini 2.0 Flash for instant replies!`, "info");
  } else {
    showToast(`Switched to ${modelObj.name} (${modelObj.speed || "100% Free"})`, "info");
  }
  return true;
}

function isAllowedModel(modelId) {
  if (!modelId || typeof modelId !== "string") return false;
  const trimmed = modelId.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes(":free") || lower.includes("openrouter")) return false;

  // 1. If catalog is loaded, check against catalog or valid local Ollama model
  if (Array.isArray(state.models) && state.models.length > 0) {
    if (state.models.some(m => m.id === trimmed)) return true;
    if (trimmed.startsWith("ollama/") && trimmed.length > 7) return true;
    return false;
  }

  // 2. Fallback before catalog loads: check known free models or valid provider prefixes
  const defaultChatModel = typeof DEFAULT_CHAT_MODEL !== "undefined" ? DEFAULT_CHAT_MODEL : "qwen/qwen3.8-27b";
  const knownPrefixes = ["groq/", "cerebras/", "ollama/", "gemini-", "qwen/", "meta-llama/"];
  const knownModels = [
    defaultChatModel,
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "cerebras/llama3.1-8b",
    "cerebras/llama3.1-70b",
    "cerebras/llama-3.3-70b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "deepseek-r1-distill-llama-70b"
  ];
  if (knownModels.includes(trimmed)) return true;
  if (knownPrefixes.some(p => trimmed.startsWith(p))) return true;

  return false;
}

function updateActiveModelUI(modelId, provider) {
  const resolveModelProvider = (id) => {
    if (typeof inferProvider === "function") return inferProvider(id);
    if (!id) return "groq";
    if (id.startsWith("ollama/")) return "ollama";
    if (id.startsWith("cerebras/")) return "cerebras";
    if (id.startsWith("gemini-")) return "gemini";
    return "groq";
  };

  const modelObj = (state.models || []).find(m => m.id === modelId) || {
    id: modelId,
    name: (modelId || "").split("/").pop().replace(":free", ""),
    provider: provider || resolveModelProvider(modelId),
    speed: "⚡ Free Tier",
    color: "#10b981"
  };

  const defaultChatModel = typeof DEFAULT_CHAT_MODEL !== "undefined" ? DEFAULT_CHAT_MODEL : "qwen/qwen3.8-27b";
  const isBest = modelId === defaultChatModel;
  const safeColor = isSafeCssColor(modelObj.color) ? modelObj.color : "#10b981";

  if (DOM.activeModelName) DOM.activeModelName.textContent = modelObj.name;
  if (DOM.activeModelDot) {
    DOM.activeModelDot.style.background = safeColor;
    DOM.activeModelDot.style.boxShadow = `0 0 8px ${safeColor}`;
  }

  if (DOM.modelPillBtn) {
    const bestBadge = DOM.modelPillBtn.querySelector(".best-badge");
    if (bestBadge) {
      bestBadge.style.display = "inline-block";
      bestBadge.textContent = isBest ? "⚡ Fastest" : (modelObj.speed || "Free");
    }
  }

  // Update input chip
  if (DOM.inputModelChip) {
    const chipName = DOM.inputModelChip.querySelector(".chip-name");
    if (chipName) chipName.textContent = `${modelObj.name} (${modelObj.speed || "Free"})`;
    const chipDot = DOM.inputModelChip.querySelector(".chip-dot");
    if (chipDot) chipDot.style.background = safeColor;
  }

  // Update welcome hero
  if (DOM.welcomeActiveModel) {
    DOM.welcomeActiveModel.textContent = `${modelObj.name} (${modelObj.speed || "Free Tier"})`;
  }

  // Close dropdown
  if (DOM.modelPillContainer) DOM.modelPillContainer.classList.remove("open");
  renderModelsUI();
  if (typeof updateApiKeyBadge === "function") updateApiKeyBadge();
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
  if (!DOM.dropdownModelsList) return;
  DOM.dropdownModelsList.replaceChildren();

  state.models.forEach(m => {
    const isSelected = m.id === state.activeModel;
    const isBest = m.id === DEFAULT_CHAT_MODEL;

    const item = document.createElement("div");
    item.className = `model-option-item ${isSelected ? "selected" : ""}`;

    const optionLeft = document.createElement("div");
    optionLeft.className = "option-left";

    const iconSpan = document.createElement("span");
    iconSpan.className = "option-icon";
    iconSpan.textContent = m.icon || "✨";

    const optionInfo = document.createElement("div");
    optionInfo.className = "option-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "option-name";
    nameSpan.textContent = m.name || m.id || "Model";

    const descSpan = document.createElement("span");
    descSpan.className = "option-desc";
    const speedPart = m.speed ? `${m.speed} • ` : "";
    descSpan.textContent = `${speedPart}${m.description || m.tagline || ""}`;

    optionInfo.appendChild(nameSpan);
    optionInfo.appendChild(descSpan);
    optionLeft.appendChild(iconSpan);
    optionLeft.appendChild(optionInfo);

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "option-badge";
    if (isBest) {
      badgeSpan.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
      badgeSpan.textContent = "⚡ Fastest";
    } else {
      badgeSpan.style.background = "rgba(255, 255, 255, 0.1)";
      badgeSpan.textContent = m.badge || "Free";
    }

    item.appendChild(optionLeft);
    item.appendChild(badgeSpan);
    item.addEventListener("click", () => selectModel(m.id, m.provider));
    DOM.dropdownModelsList.appendChild(item);
  });

  // Full models grid in Modal
  if (!DOM.fullModelsGrid) return;
  DOM.fullModelsGrid.replaceChildren();

  state.models.forEach(m => {
    const isSelected = m.id === state.activeModel;
    const isBest = m.id === DEFAULT_CHAT_MODEL;

    const card = document.createElement("div");
    card.className = `model-card ${isSelected ? "active" : ""}`;

    const cardTop = document.createElement("div");
    cardTop.className = "card-top";

    const nameRow = document.createElement("div");
    nameRow.className = "card-name-row";

    const iconSpan = document.createElement("span");
    iconSpan.textContent = m.icon || "✨";

    const nameSpan = document.createElement("span");
    nameSpan.className = "card-m-name";
    nameSpan.textContent = m.name || m.id || "Model";

    nameRow.appendChild(iconSpan);
    nameRow.appendChild(nameSpan);

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "card-badge";
    if (isBest) {
      badgeSpan.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
      badgeSpan.textContent = "★ Fastest & Best Default";
    } else {
      const safeColor = isSafeCssColor(m.color) ? m.color : "#8b5cf6";
      badgeSpan.style.background = safeColor;
      badgeSpan.textContent = m.badge || "Free";
    }

    cardTop.appendChild(nameRow);
    cardTop.appendChild(badgeSpan);

    const speedDiv = document.createElement("div");
    speedDiv.className = "card-speed";
    speedDiv.style.cssText = "font-size: 0.72rem; color: #10b981; font-weight: 700;";
    speedDiv.textContent = m.speed || "100% Free";

    const descDiv = document.createElement("div");
    descDiv.className = "card-m-desc";
    descDiv.textContent = m.description || m.tagline || "";

    const idDiv = document.createElement("div");
    idDiv.style.cssText = "font-size: 0.7rem; color: var(--text-faint); font-family: var(--font-mono);";
    idDiv.textContent = m.id || "";

    card.appendChild(cardTop);
    card.appendChild(speedDiv);
    card.appendChild(descDiv);
    card.appendChild(idDiv);

    card.addEventListener("click", () => selectModel(m.id, m.provider));
    DOM.fullModelsGrid.appendChild(card);
  });
}

function renderEmbeddingsUI() {
  if (!DOM.embeddingsGrid) return;
  DOM.embeddingsGrid.replaceChildren();

  state.embeddingModels.forEach(m => {
    const isSelected = m.id === state.activeEmbeddingModel;
    const isBest = m.id === DEFAULT_EMBEDDING_MODEL;

    const card = document.createElement("div");
    card.className = `model-card ${isSelected ? "active" : ""}`;

    const cardTop = document.createElement("div");
    cardTop.className = "card-top";

    const nameSpan = document.createElement("span");
    nameSpan.className = "card-m-name";
    nameSpan.textContent = m.name || m.id;

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "card-badge";
    if (isBest) {
      badgeSpan.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
      badgeSpan.textContent = "★ Best Default";
    } else {
      badgeSpan.style.background = "#3b82f6";
      badgeSpan.textContent = `${m.dimensions || 1536}d`;
    }

    cardTop.appendChild(nameSpan);
    cardTop.appendChild(badgeSpan);

    const descDiv = document.createElement("div");
    descDiv.className = "card-m-desc";
    descDiv.textContent = m.description || "Vector embedding representation model.";

    const idDiv = document.createElement("div");
    idDiv.style.cssText = "font-size: 0.7rem; color: var(--text-faint); font-family: var(--font-mono);";
    idDiv.textContent = m.id || "";

    card.appendChild(cardTop);
    card.appendChild(descDiv);
    card.appendChild(idDiv);

    card.addEventListener("click", () => selectEmbeddingModel(m.id));
    DOM.embeddingsGrid.appendChild(card);
  });
}

// ==========================================================
// USER PC SPECIAL FOLDER STORAGE (File System Access API & IndexedDB)
// ==========================================================
const IDB_NAME = "RoroGPT_Storage";
const IDB_VERSION = 3;
const IDB_STORE = "handles";
const IDB_STORE_LIB = "library_items";
const IDB_STORE_SKILLS = "skills";
const IDB_STORE_BLOBS = "attachment_blobs";

if (typeof window !== "undefined") {
  window.IDB_VERSION = IDB_VERSION;
  window.IDB_STORE_BLOBS = IDB_STORE_BLOBS;
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const idb = typeof indexedDB !== "undefined" ? indexedDB : (typeof window !== "undefined" ? window.indexedDB : null);
    if (!idb) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }
    const req = idb.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
      if (!db.objectStoreNames.contains(IDB_STORE_LIB)) db.createObjectStore(IDB_STORE_LIB, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_STORE_SKILLS)) db.createObjectStore(IDB_STORE_SKILLS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_STORE_BLOBS)) db.createObjectStore(IDB_STORE_BLOBS, { keyPath: "id" });
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
    throw e;
  }
}

async function idbGet(storeName, key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
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

// Active Object URL registry with memory leak prevention
const activeObjectUrls = new Map(); // blobId -> objectUrl

function getObjectUrlForBlob(blobId, blob) {
  if (activeObjectUrls.has(blobId)) {
    return activeObjectUrls.get(blobId);
  }
  if (!blob || typeof URL === "undefined" || !URL.createObjectURL) {
    return "";
  }
  try {
    const url = URL.createObjectURL(blob);
    activeObjectUrls.set(blobId, url);
    return url;
  } catch (e) {
    console.warn("Failed creating object URL for blob:", blobId, e);
    return "";
  }
}

function revokeObjectUrl(blobId) {
  if (activeObjectUrls.has(blobId)) {
    const url = activeObjectUrls.get(blobId);
    if (typeof URL !== "undefined" && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    activeObjectUrls.delete(blobId);
  }
}

function revokeAllObjectUrls() {
  for (const [blobId, url] of activeObjectUrls.entries()) {
    if (typeof URL !== "undefined" && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }
  activeObjectUrls.clear();
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const match = parts[0].match(/:(.*?);/);
  const mime = match ? match[1] : "image/jpeg";
  try {
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    if (!blob) return resolve("");
    if (typeof FileReader === "undefined") return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

// In-memory fallback if IndexedDB is unavailable in current context
const inMemoryBlobStore = new Map();

async function storeAttachmentBlob(blobOrDataUrl, mimeType = "image/jpeg", customId = null) {
  if (!blobOrDataUrl) return null;
  const blobId = customId || ("blob_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6));

  let blob = blobOrDataUrl;
  let size = 0;
  let type = mimeType;

  if (typeof blobOrDataUrl === "string") {
    if (blobOrDataUrl.startsWith("data:")) {
      blob = dataUrlToBlob(blobOrDataUrl);
      if (blob) {
        size = blob.size;
        type = blob.type || mimeType;
      }
    }
  } else if (typeof Blob !== "undefined" && blobOrDataUrl instanceof Blob) {
    size = blobOrDataUrl.size;
    type = blobOrDataUrl.type || mimeType;
  }

  const record = {
    id: blobId,
    blob: blob,
    mimeType: type,
    size: size,
    createdAt: Date.now()
  };

  try {
    await idbPut(IDB_STORE_BLOBS, record);
  } catch {
    inMemoryBlobStore.set(blobId, record);
  }
  return blobId;
}

async function getAttachmentBlob(blobId) {
  if (!blobId) return null;
  const record = await idbGet(IDB_STORE_BLOBS, blobId);
  if (record) return record;
  return inMemoryBlobStore.get(blobId) || null;
}

async function deleteAttachmentBlob(blobId) {
  if (!blobId) return;
  revokeObjectUrl(blobId);
  inMemoryBlobStore.delete(blobId);
  await idbDelete(IDB_STORE_BLOBS, blobId);
}

// Reachability scan: safely cleans orphaned blobs not referenced in any chat, composer tray, or library
async function cleanupOrphanedBlobs() {
  const referencedBlobIds = new Set();

  // 1. Referenced in chats
  for (const chat of Object.values(state.chats || {})) {
    for (const msg of chat.messages || []) {
      for (const att of msg.attachments || []) {
        if (att.blobId) referencedBlobIds.add(att.blobId);
      }
    }
  }

  // 2. Referenced in composer tray
  for (const att of state.attachments || []) {
    if (att.blobId) referencedBlobIds.add(att.blobId);
  }

  // 3. Referenced in Personal Library
  const libItems = await idbGetAll(IDB_STORE_LIB);
  for (const item of libItems || []) {
    if (item.blobId) referencedBlobIds.add(item.blobId);
  }

  // 4. Scan stored blobs in IndexedDB
  const allBlobs = await idbGetAll(IDB_STORE_BLOBS);
  let cleanedCount = 0;
  for (const record of allBlobs || []) {
    if (!referencedBlobIds.has(record.id)) {
      await deleteAttachmentBlob(record.id);
      cleanedCount++;
    }
  }

  // Also scan in-memory fallback
  for (const id of inMemoryBlobStore.keys()) {
    if (!referencedBlobIds.has(id)) {
      deleteAttachmentBlob(id);
      cleanedCount++;
    }
  }

  const remaining = referencedBlobIds.size;
  await updateStorageStatusUI();
  return { cleaned: cleanedCount, remaining: Math.max(0, remaining) };
}

async function updateStorageStatusUI() {
  if (DOM.storageHealthBadge) {
    if (state.storageHealth === "healthy") {
      DOM.storageHealthBadge.textContent = "🟢 Healthy";
      DOM.storageHealthBadge.style.background = "rgba(16, 185, 129, 0.2)";
      DOM.storageHealthBadge.style.color = "#10b981";
    } else if (state.storageHealth === "degraded") {
      DOM.storageHealthBadge.textContent = "🟡 Degraded (Quota Warning)";
      DOM.storageHealthBadge.style.background = "rgba(245, 158, 11, 0.2)";
      DOM.storageHealthBadge.style.color = "#f59e0b";
    } else {
      DOM.storageHealthBadge.textContent = "🔴 Storage Full";
      DOM.storageHealthBadge.style.background = "rgba(239, 68, 68, 0.2)";
      DOM.storageHealthBadge.style.color = "#ef4444";
    }
  }

  if (DOM.storageIndicatorDot) {
    DOM.storageIndicatorDot.className = `storage-dot ${state.storageHealth || "healthy"}`;
  }

  if (DOM.storageUsageText) {
    try {
      if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        DOM.storageUsageText.textContent = `Browser Storage: ~${usedMB} MB used of ~${quotaMB} MB quota`;
      } else {
        const lsLen = (JSON.stringify(localStorage || {}).length / 1024).toFixed(1);
        DOM.storageUsageText.textContent = `LocalStorage: ~${lsLen} KB used (IndexedDB Blobs Active)`;
      }
    } catch {
      DOM.storageUsageText.textContent = "Local Browser Storage (IndexedDB • 100% Private)";
    }
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

    // 1. Format Human-Readable Markdown with accurate model history and turn attribution
    const currentModel = chat.model || DEFAULT_CHAT_MODEL;
    const currentProvider = chat.provider || inferProvider(currentModel);
    let md = `# ${chat.title}\n*Saved locally by RoroGPT on ${new Date().toLocaleString()}*\n*Current Selected Model: ${currentModel} (Provider: ${currentProvider})*\n*Chat ID: ${chat.id}*\n\n---\n\n`;

    const usedModels = new Set();
    (chat.messages || []).forEach(m => {
      if (m.role === "assistant" && m.model) {
        usedModels.add(`${m.model}${m.provider ? " (" + m.provider + ")" : ""}`);
      }
    });
    if (usedModels.size > 0) {
      md += `**Model History:** ${Array.from(usedModels).join(", ")}\n\n---\n\n`;
    }

    (chat.messages || []).forEach(m => {
      if (m.role === "user") {
        md += `### 👤 User\n\n`;
      } else {
        const modelLabel = m.model || "unknown/legacy";
        const providerLabel = m.provider ? ` • Provider: ${m.provider}` : "";
        md += `### 🤖 RoroGPT (${modelLabel}${providerLabel})\n\n`;
      }
      if (m.reasoning) {
        md += `> **Thinking Process:**\n> ${m.reasoning.replace(/\n/g, "\n> ")}\n\n`;
      }
      md += `${m.content}\n\n`;
    });

    // 2. Format JSON representation (Preserve structured model metadata, strip secrets)
    const exportChatData = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      model: currentModel,
      provider: currentProvider,
      messages: (chat.messages || []).map(m => {
        const cleanMsg = {
          role: m.role,
          content: m.content
        };
        if (m.reasoning) cleanMsg.reasoning = m.reasoning;
        if (m.role === "assistant") {
          cleanMsg.model = m.model || "unknown/legacy";
          cleanMsg.provider = m.provider || "unknown";
          if (m.modelName) cleanMsg.modelName = m.modelName;
        }
        if (Array.isArray(m.attachments)) {
          cleanMsg.attachments = m.attachments.map(att => {
            const { base64Data, previewUrl, ...safeAtt } = att;
            return safeAtt;
          });
        }
        return cleanMsg;
      })
    };
    const jsonStr = JSON.stringify(exportChatData, null, 2);

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

    // 3. Write image attachment binaries to PC folder if present
    if (Array.isArray(chat.messages)) {
      for (const msg of chat.messages) {
        if (Array.isArray(msg.attachments)) {
          for (const att of msg.attachments) {
            if (att.type === "image" && att.blobId) {
              try {
                const rec = await getAttachmentBlob(att.blobId);
                if (rec && rec.blob) {
                  const safeAttName = `${chat.id}_${(att.name || "photo.jpg").replace(/[^a-z0-9._\-]/gi, "_")}`;
                  const attHandle = await state.dirHandle.getFileHandle(safeAttName, { create: true });
                  const attWritable = await attHandle.createWritable();
                  await attWritable.write(rec.blob);
                  await attWritable.close();
                }
              } catch (e) {
                console.warn("[RoroGPT] Failed exporting attachment to PC folder:", e);
              }
            }
          }
        }
      }
    }

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
      await migrateLegacyChats();
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
    DOM.attachmentsTray.replaceChildren();
    if (DOM.sendBtn) {
      DOM.sendBtn.disabled = DOM.chatInput.value.trim().length === 0 || state.isGenerating;
    }
    return;
  }

  DOM.attachmentsTray.style.display = "flex";
  DOM.attachmentsTray.replaceChildren();

  state.attachments.forEach(att => {
    const chip = document.createElement("div");
    chip.className = `attachment-chip ${att.type}`;
    chip.setAttribute("data-id", att.id);

    // Visual element: Safe image thumbnail or icon
    if (att.type === "image") {
      const rawSrc = (att.previewUrl || att.base64Data || "").trim();
      if (rawSrc && isSafeUrl(rawSrc, true)) {
        const thumb = document.createElement("img");
        thumb.className = "chip-thumbnail";
        thumb.src = rawSrc;
        thumb.alt = att.name || "Attachment";
        chip.appendChild(thumb);
      } else if (att.blobId) {
        const thumb = document.createElement("img");
        thumb.className = "chip-thumbnail loading-thumb";
        thumb.alt = att.name || "Attachment";
        chip.appendChild(thumb);
        getAttachmentBlob(att.blobId).then(rec => {
          if (rec && rec.blob) {
            const url = getObjectUrlForBlob(att.blobId, rec.blob);
            if (url) {
              thumb.src = url;
              thumb.classList.remove("loading-thumb");
            }
          }
        }).catch(() => {});
      } else {
        const iconSpan = document.createElement("span");
        iconSpan.className = "chip-icon";
        iconSpan.textContent = "🖼️";
        chip.appendChild(iconSpan);
      }
    } else {
      const iconSpan = document.createElement("span");
      iconSpan.className = "chip-icon";
      iconSpan.textContent = att.type === "weblink" ? "🔗" : att.type === "skill" ? "⚡" : "📄";
      chip.appendChild(iconSpan);
    }

    // Chip Info
    const infoDiv = document.createElement("div");
    infoDiv.className = "chip-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "chip-name";
    nameSpan.title = att.name || "";
    nameSpan.textContent = att.name || "Attachment";

    const metaSpan = document.createElement("span");
    metaSpan.className = "chip-meta";
    metaSpan.textContent = att.meta || "";

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(metaSpan);
    chip.appendChild(infoDiv);

    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "chip-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "chip-btn chip-save-btn";
    saveBtn.title = "Save to Personal Library";
    saveBtn.type = "button";

    const saveSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    saveSvg.setAttribute("viewBox", "0 0 24 24");
    saveSvg.setAttribute("fill", "none");
    saveSvg.setAttribute("stroke", "currentColor");
    saveSvg.setAttribute("stroke-width", "2");

    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    p2.setAttribute("points", "17 21 17 13 7 13 7 21");
    const p3 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    p3.setAttribute("points", "7 3 7 8 15 8");
    saveSvg.appendChild(p1);
    saveSvg.appendChild(p2);
    saveSvg.appendChild(p3);
    saveBtn.appendChild(saveSvg);

    const removeBtn = document.createElement("button");
    removeBtn.className = "chip-btn chip-remove-btn";
    removeBtn.title = "Remove attachment";
    removeBtn.type = "button";
    removeBtn.textContent = "×";

    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(removeBtn);
    chip.appendChild(actionsDiv);

    removeBtn.addEventListener("click", () => {
      removeAttachment(att.id);
    });

    saveBtn.addEventListener("click", () => {
      saveAttachmentToLibrary(att.id);
    });

    DOM.attachmentsTray.appendChild(chip);
  });

  if (DOM.sendBtn) {
    DOM.sendBtn.disabled = state.isGenerating;
  }
}

function removeAttachment(id) {
  const att = state.attachments.find(a => a.id === id);
  if (att && att.blobId) {
    revokeObjectUrl(att.blobId);
  }
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
  if (libItem.blobId && libItem.base64Data) {
    delete libItem.base64Data;
  }
  try {
    await idbPut(IDB_STORE_LIB, libItem);
  } catch {
    state.libraryItems.push(libItem);
  }
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

      // Check for content limit (100,000 characters to avoid silent truncation)
      let isTruncated = false;
      const MAX_DOC_CHARS = 100000;
      if (extractedText.length > MAX_DOC_CHARS) {
        extractedText = extractedText.slice(0, MAX_DOC_CHARS) + `\n\n[...Document truncated to first ${MAX_DOC_CHARS.toLocaleString()} characters to fit model context window and storage limits...]`;
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
async function handlePhotoFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    if (file.size > 12 * 1024 * 1024) {
      showToast(`Image "${file.name}" exceeds 12MB limit.`, "error");
      continue;
    }

    try {
      const blobId = await storeAttachmentBlob(file, file.type || "image/jpeg");
      const objectUrl = getObjectUrlForBlob(blobId, file);

      const attachment = {
        id: "att_img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        type: "image",
        name: file.name,
        size: file.size,
        mimeType: file.type || "image/jpeg",
        blobId: blobId,
        previewUrl: objectUrl,
        meta: formatBytes(file.size),
        createdAt: Date.now()
      };
      state.attachments.push(attachment);
      renderAttachmentsTray();
      showToast(`Attached photo "${file.name}"!`, "success");
    } catch (err) {
      showToast(`Could not read "${file.name}": ${err.message}`, "error");
    }
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

  if (typeof closeMobileSidebar === "function") closeMobileSidebar();
  DOM.cameraModal.classList.add("open");
  if (typeof updateModalBodyScroll === "function") updateModalBodyScroll();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (DOM.cameraErrorBanner) {
      DOM.cameraErrorBanner.style.display = "block";
      DOM.cameraErrorBanner.textContent = "Camera API is not supported in this browser. Please use 'Upload photos' instead.";
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
      DOM.cameraErrorBanner.textContent = `Camera access error: ${normalizeErrorMessage(err.message)}. Please allow camera permissions or use 'Upload photos'.`;
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
  if (typeof updateModalBodyScroll === "function") updateModalBodyScroll();
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

async function useCapturedPhoto() {
  if (!state.capturedPhotoData) return;
  const timestamp = new Date().toLocaleTimeString().replace(/:/g, "-");
  const fileName = `Camera_Photo_${timestamp}.jpg`;
  const estimatedSize = Math.round((state.capturedPhotoData.length * 3) / 4);

  try {
    const blob = dataUrlToBlob(state.capturedPhotoData);
    const blobId = await storeAttachmentBlob(blob || state.capturedPhotoData, "image/jpeg");
    const objectUrl = blob ? getObjectUrlForBlob(blobId, blob) : "";

    const attachment = {
      id: "att_cam_" + Date.now(),
      type: "image",
      name: fileName,
      size: estimatedSize,
      mimeType: "image/jpeg",
      blobId: blobId,
      previewUrl: objectUrl,
      meta: formatBytes(estimatedSize),
      createdAt: Date.now()
    };

    state.attachments.push(attachment);
    renderAttachmentsTray();
    closeCameraModal();
    showToast("Photo captured and attached!", "success");
  } catch (err) {
    showToast(`Failed saving captured photo: ${err.message}`, "error");
  }
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
  DOM.webLinkStatusBox.replaceChildren();
  const dot = document.createElement("span");
  dot.className = "pulsing-dot";
  const statusMsg = document.createElement("span");
  statusMsg.textContent = "Fetching and analyzing webpage content safely...";
  DOM.webLinkStatusBox.appendChild(dot);
  DOM.webLinkStatusBox.appendChild(statusMsg);
  DOM.fetchAndAttachUrlBtn.disabled = true;

  try {
    const fetchHeaders = { "Content-Type": "application/json" };
    if (state.appToken) {
      fetchHeaders["x-app-token"] = state.appToken;
    }

    const res = await fetch("/api/fetch-url", {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify({ url, appToken: state.appToken })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Web content retrieval failed");
    }

    let siteHostname = "";
    try {
      siteHostname = new URL(url).hostname;
    } catch {
      siteHostname = url;
    }

    DOM.webLinkStatusBox.className = "weblink-status-box success";
    DOM.webLinkStatusBox.replaceChildren();
    const succIcon = document.createElement("span");
    succIcon.textContent = "✅ ";
    const strongTitle = document.createElement("strong");
    strongTitle.textContent = data.title || siteHostname;
    const contentLen = data.content ? data.content.length : 0;
    DOM.webLinkStatusBox.appendChild(succIcon);
    DOM.webLinkStatusBox.appendChild(document.createTextNode('Successfully extracted "'));
    DOM.webLinkStatusBox.appendChild(strongTitle);
    DOM.webLinkStatusBox.appendChild(document.createTextNode(`" (${contentLen} chars).`));

    // Safeguard: Truncate web content if exceptionally long (> 100,000 characters)
    let webContent = data.content || "";
    let isTruncated = false;
    const MAX_WEB_CHARS = 100000;
    if (webContent.length > MAX_WEB_CHARS) {
      webContent = webContent.slice(0, MAX_WEB_CHARS) + `\n\n[...Website content truncated to first ${MAX_WEB_CHARS.toLocaleString()} characters to fit storage limits...]`;
      isTruncated = true;
    }

    const metaParts = [`Web Link • ${data.siteName || siteHostname}`];
    if (isTruncated) metaParts.push("Truncated");

    const attachment = {
      id: "att_url_" + Date.now(),
      type: "weblink",
      name: data.title || siteHostname,
      url: url,
      instruction: instruction,
      textContent: webContent,
      summary: data.description || "",
      siteName: data.siteName || siteHostname,
      meta: metaParts.join(" • "),
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
    DOM.webLinkStatusBox.replaceChildren();
    DOM.webLinkStatusBox.textContent = `⚠️ ${normalizeErrorMessage(err.message)}`;
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
  DOM.skillsListContainer.replaceChildren();
  if (DOM.savedSkillsCount) DOM.savedSkillsCount.textContent = state.skills.length;

  if (state.skills.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.style.cssText = "padding:20px; text-align:center; color:var(--text-muted);";
    hint.textContent = "No skills created yet. Use the \"Create or Import Skill\" tab above to add reusable AI instructions!";
    DOM.skillsListContainer.appendChild(hint);
    return;
  }

  state.skills.forEach(skill => {
    const isActive = state.activeSkill && state.activeSkill.id === skill.id;
    const card = document.createElement("div");
    card.className = `skill-card ${isActive ? "active" : ""}`;

    const mainDiv = document.createElement("div");
    mainDiv.className = "skill-card-main";

    const headerDiv = document.createElement("div");
    headerDiv.className = "skill-card-header";

    const titleSpan = document.createElement("span");
    titleSpan.className = "skill-card-title";
    titleSpan.textContent = skill.name || "Custom Skill";

    headerDiv.appendChild(titleSpan);
    if (isActive) {
      const activeBadge = document.createElement("span");
      activeBadge.className = "skill-active-badge";
      activeBadge.textContent = "Active in Chat";
      headerDiv.appendChild(activeBadge);
    }

    const descDiv = document.createElement("div");
    descDiv.className = "skill-card-desc";
    descDiv.textContent = skill.description || "Custom AI instructions";

    mainDiv.appendChild(headerDiv);
    mainDiv.appendChild(descDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "skill-card-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = `btn btn-sm ${isActive ? "btn-secondary" : "btn-primary"} skill-toggle-btn`;
    toggleBtn.type = "button";
    toggleBtn.textContent = isActive ? "Deactivate" : "⚡ Activate";

    const previewBtn = document.createElement("button");
    previewBtn.className = "btn btn-sm btn-secondary skill-preview-btn";
    previewBtn.title = "View Instructions";
    previewBtn.type = "button";
    previewBtn.textContent = "👁️ Preview";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn skill-delete-btn";
    deleteBtn.title = "Delete skill";
    deleteBtn.style.color = "var(--text-faint)";
    deleteBtn.type = "button";
    deleteBtn.textContent = "×";

    actionsDiv.appendChild(toggleBtn);
    actionsDiv.appendChild(previewBtn);
    actionsDiv.appendChild(deleteBtn);

    card.appendChild(mainDiv);
    card.appendChild(actionsDiv);

    toggleBtn.addEventListener("click", () => {
      if (isActive) {
        deactivateSkill();
      } else {
        activateSkill(skill);
      }
    });

    previewBtn.addEventListener("click", () => {
      const pre = document.createElement("pre");
      pre.style.cssText = "white-space:pre-wrap; font-family:var(--font-mono); font-size:0.85rem;";
      pre.textContent = skill.instructions || "";
      openPreviewModal("⚡", skill.name, pre, skill);
    });

    deleteBtn.addEventListener("click", async () => {
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
  DOM.libraryGridContainer.replaceChildren();

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
    const emptyBox = document.createElement("div");
    emptyBox.style.cssText = "grid-column: 1 / -1; padding: 36px 16px; text-align: center; color: var(--text-muted);";

    const emptyIcon = document.createElement("div");
    emptyIcon.style.cssText = "font-size: 2rem; margin-bottom: 8px;";
    emptyIcon.textContent = "📚";

    const emptyTitle = document.createElement("p");
    emptyTitle.style.cssText = "font-weight: 600; margin-bottom: 4px;";
    emptyTitle.textContent = "No library items found";

    const emptyHint = document.createElement("span");
    emptyHint.style.cssText = "font-size: 0.8rem;";
    emptyHint.textContent = "Attach documents, photos, links, or skills in the composer and click the 💾 save icon to store them here permanently!";

    emptyBox.append(emptyIcon, emptyTitle, emptyHint);
    DOM.libraryGridContainer.appendChild(emptyBox);
    return;
  }

  filtered.sort((a, b) => (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0));

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "lib-card";

    const topDiv = document.createElement("div");
    topDiv.className = "lib-card-top";

    if (item.type === "image") {
      const rawSrc = (item.previewUrl || item.base64Data || "").trim();
      if (rawSrc && isSafeUrl(rawSrc, true)) {
        const img = document.createElement("img");
        img.src = rawSrc;
        img.className = "lib-card-img-thumb";
        img.alt = item.name || "Library Image";
        topDiv.appendChild(img);
      } else if (item.blobId) {
        const img = document.createElement("img");
        img.className = "lib-card-img-thumb loading-thumb";
        img.alt = item.name || "Library Image";
        topDiv.appendChild(img);
        getAttachmentBlob(item.blobId).then(rec => {
          if (rec && rec.blob) {
            const url = getObjectUrlForBlob(item.blobId, rec.blob);
            if (url) {
              img.src = url;
              img.classList.remove("loading-thumb");
            }
          }
        }).catch(() => {});
      } else {
        const iconSpan = document.createElement("span");
        iconSpan.className = "lib-card-icon";
        iconSpan.textContent = "🖼️";
        topDiv.appendChild(iconSpan);
      }
    } else {
      const icon = item.type === "weblink" ? "🔗" : item.type === "skill" ? "⚡" : "📄";
      const iconSpan = document.createElement("span");
      iconSpan.className = "lib-card-icon";
      iconSpan.textContent = icon;
      topDiv.appendChild(iconSpan);
    }

    const titleBox = document.createElement("div");
    titleBox.className = "lib-card-title-box";

    const titleSpan = document.createElement("span");
    titleSpan.className = "lib-card-title";
    titleSpan.title = item.name || "Untitled";
    titleSpan.textContent = item.name || "Untitled";

    const metaSpan = document.createElement("span");
    metaSpan.className = "lib-card-meta";
    metaSpan.textContent = item.meta || item.type || "";

    titleBox.append(titleSpan, metaSpan);
    topDiv.appendChild(titleBox);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "lib-card-actions";

    const attachBtn = document.createElement("button");
    attachBtn.className = "btn btn-sm btn-primary lib-attach-btn";
    attachBtn.title = "Add to current chat";
    attachBtn.textContent = "➕ Attach";
    attachBtn.addEventListener("click", () => attachLibraryItemToChat(item));

    const previewBtn = document.createElement("button");
    previewBtn.className = "btn btn-sm btn-secondary lib-preview-btn";
    previewBtn.title = "Preview item";
    previewBtn.textContent = "👁️ View";
    previewBtn.addEventListener("click", () => previewLibraryItem(item));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn lib-delete-btn";
    deleteBtn.title = "Delete from Library";
    deleteBtn.style.color = "var(--text-faint)";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Remove "${item.name}" from your Personal Library?`)) {
        await idbDelete(IDB_STORE_LIB, item.id);
        await loadLibrary();
        showToast("Item removed from library", "info");
      }
    });

    actionsDiv.append(attachBtn, previewBtn, deleteBtn);
    card.append(topDiv, actionsDiv);
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
  if (DOM.libraryModal) DOM.libraryModal.classList.remove("open");
  showToast(`Attached "${item.name}" from Library!`, "success");
}

function previewLibraryItem(item) {
  let contentNode;
  if (item.type === "image") {
    const rawSrc = (item.previewUrl || item.base64Data || "").trim();
    if (rawSrc && isSafeUrl(rawSrc, true)) {
      const container = document.createElement("div");
      container.style.textAlign = "center";
      const img = document.createElement("img");
      img.src = rawSrc;
      img.alt = item.name || "Preview Image";
      img.style.cssText = "max-width:100%; max-height:480px; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.3);";
      container.appendChild(img);
      contentNode = container;
    } else if (item.blobId) {
      const container = document.createElement("div");
      container.style.textAlign = "center";
      const img = document.createElement("img");
      img.className = "loading-thumb";
      img.alt = item.name || "Preview Image";
      img.style.cssText = "max-width:100%; max-height:480px; border-radius:8px;";
      container.appendChild(img);
      contentNode = container;
      getAttachmentBlob(item.blobId).then(rec => {
        if (rec && rec.blob) {
          const url = getObjectUrlForBlob(item.blobId, rec.blob);
          if (url) {
            img.src = url;
            img.classList.remove("loading-thumb");
            return;
          }
        }
        container.replaceChildren();
        const p = document.createElement("p");
        p.className = "empty-hint";
        p.textContent = "⚠️ Attachment unavailable (image not found in local storage).";
        container.appendChild(p);
      }).catch(() => {
        container.replaceChildren();
        const p = document.createElement("p");
        p.className = "empty-hint";
        p.textContent = "⚠️ Attachment unavailable (image not found in local storage).";
        container.appendChild(p);
      });
    } else {
      const p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "⚠️ Attachment unavailable (image not found in local storage).";
      contentNode = p;
    }
  } else if (item.textContent || item.instructions) {
    const pre = document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap; font-family:var(--font-mono); font-size:0.84rem;";
    pre.textContent = item.textContent || item.instructions;
    contentNode = pre;
  } else {
    const p = document.createElement("p");
    p.textContent = item.summary || "No preview content available.";
    contentNode = p;
  }

  const icon = item.type === "image" ? "🖼️" : item.type === "weblink" ? "🔗" : item.type === "skill" ? "⚡" : "📄";
  openPreviewModal(icon, item.name, contentNode, item);
}

function openPreviewModal(icon, title, bodyContent, itemToAttach = null) {
  DOM.previewModalIcon.textContent = icon;
  DOM.previewModalTitle.textContent = title;
  if (bodyContent instanceof Node) {
    DOM.previewModalBody.replaceChildren(bodyContent);
  } else if (typeof bodyContent === "string") {
    DOM.previewModalBody.innerHTML = sanitizeRenderedHtml(bodyContent);
  } else {
    DOM.previewModalBody.replaceChildren();
  }
  state.previewPendingItem = itemToAttach;

  if (itemToAttach) {
    DOM.previewAttachToChatBtn.style.display = "inline-block";
  } else {
    DOM.previewAttachToChatBtn.style.display = "none";
  }

  DOM.itemPreviewModal.classList.add("open");
  if (typeof updateModalBodyScroll === "function") updateModalBodyScroll();
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

      if (item.type === "image") {
        let blob = null;
        if (item.blobId) {
          const rec = await getAttachmentBlob(item.blobId);
          if (rec && rec.blob) blob = rec.blob;
        } else if (item.base64Data) {
          blob = dataUrlToBlob(item.base64Data);
        }
        if (blob) {
          const ext = (blob.type || "").includes("png") ? "png" : "jpg";
          const fileHandle = await libFolder.getFileHandle(`${safeTitle}.${ext}`, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          count++;
        }
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
function prepareChatsForLocalStorage(chats) {
  if (!chats || typeof chats !== "object") return {};
  const cleaned = {};
  for (const [id, chat] of Object.entries(chats)) {
    if (!chat) continue;
    cleaned[id] = {
      ...chat,
      messages: Array.isArray(chat.messages)
        ? chat.messages.map(m => {
            const cleanMsg = { ...m };
            if (Array.isArray(cleanMsg.attachments)) {
              cleanMsg.attachments = cleanMsg.attachments.map(att => {
                const { base64Data, previewUrl, ...metaOnly } = att;
                return metaOnly;
              });
            }
            if (Array.isArray(cleanMsg.content)) {
              const textPart = cleanMsg.content.find(p => p.type === "text");
              cleanMsg.content = textPart ? textPart.text : (cleanMsg.displayContent || "");
            }
            return cleanMsg;
          })
        : []
    };
  }
  return cleaned;
}

function recoverFromQuotaExceeded(preparedChats) {
  const recovered = {};
  for (const [id, chat] of Object.entries(preparedChats)) {
    recovered[id] = {
      ...chat,
      messages: (chat.messages || []).map(m => {
        const msgCopy = { ...m };
        if (typeof msgCopy.content === "string" && msgCopy.content.length > 50000) {
          msgCopy.content = msgCopy.content.slice(0, 50000) + "\n\n[...Message compressed to preserve storage quota...]";
        }
        return msgCopy;
      })
    };
  }
  return recovered;
}

function saveChatsToStorage() {
  const prepared = prepareChatsForLocalStorage(state.chats);
  let success = false;
  try {
    localStorage.setItem("roro_chats", JSON.stringify(prepared));
    state.storageHealth = "healthy";
    success = true;
  } catch (err) {
    console.warn("[RoroGPT] Quota exceeded saving chats to localStorage:", err);
    state.storageHealth = "degraded";
    try {
      const recovered = recoverFromQuotaExceeded(prepared);
      localStorage.setItem("roro_chats", JSON.stringify(recovered));
      showToast("⚠️ Storage quota reached: Long messages compressed to avoid data loss.", "warning");
      success = true;
    } catch (recErr) {
      console.error("[RoroGPT] Storage recovery failed:", recErr);
      state.storageHealth = "unavailable";
      showToast("⚠️ Browser storage full. Please export chats or clean up conversations.", "error");
    }
  }

  updateStorageStatusUI();

  if (state.currentChatId) {
    try {
      localStorage.setItem("roro_last_active_chat", state.currentChatId);
    } catch {}
    if (state.dirHandle && state.chats[state.currentChatId]) {
      autoSaveChatToPC(state.chats[state.currentChatId]);
    }
  }
  renderConversationsSidebar();
  return success;
}

async function migrateLegacyChats() {
  let modified = false;
  const chats = state.chats;
  if (!chats || typeof chats !== "object") return false;

  for (const chat of Object.values(chats)) {
    if (!chat || typeof chat !== "object") continue;

    // 1. Normalize conversation-level model metadata (Current turn default selection)
    const defaultChatModel = typeof DEFAULT_CHAT_MODEL !== "undefined" ? DEFAULT_CHAT_MODEL : "qwen/qwen3.8-27b";
    if (!chat.model || typeof chat.model !== "string" || chat.model.includes(":free")) {
      chat.model = defaultChatModel;
      chat.provider = inferProvider(defaultChatModel);
      modified = true;
    } else if (!chat.provider) {
      chat.provider = inferProvider(chat.model);
      modified = true;
    }

    if (!Array.isArray(chat.messages)) continue;
    for (const msg of chat.messages) {
      if (!msg || typeof msg !== "object") continue;

      // 2. Normalize assistant turn model metadata
      if (msg.role === "assistant") {
        if (!msg.model || typeof msg.model !== "string") {
          msg.model = "unknown/legacy";
          msg.provider = "unknown";
          msg.modelName = "Legacy Model";
          modified = true;
        } else if (msg.model.includes(":free")) {
          msg.model = msg.model.replace(":free", "");
          if (!msg.provider || msg.provider === "openrouter") {
            msg.provider = inferProvider(msg.model);
          }
          modified = true;
        } else if (!msg.provider) {
          msg.provider = inferProvider(msg.model);
          modified = true;
        }
      }

      if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att.type === "image" && !att.blobId) {
            const raw = att.base64Data || (att.previewUrl && att.previewUrl.startsWith("data:") ? att.previewUrl : null);
            if (raw) {
              const blobId = await storeAttachmentBlob(raw, att.mimeType || "image/jpeg");
              att.blobId = blobId;
              delete att.base64Data;
              if (att.previewUrl && att.previewUrl.startsWith("data:")) {
                delete att.previewUrl;
              }
              modified = true;
            }
          }
        }
      }
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "image_url" && part.image_url?.url?.startsWith("data:")) {
            const blobId = await storeAttachmentBlob(part.image_url.url);
            if (!msg.attachments) msg.attachments = [];
            if (!msg.attachments.some(a => a.blobId === blobId)) {
              msg.attachments.push({
                id: "att_migrated_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                type: "image",
                name: "migrated_image.jpg",
                blobId: blobId,
                mimeType: "image/jpeg",
                meta: "Migrated",
                createdAt: Date.now()
              });
            }
            modified = true;
          }
        }
        const textPart = msg.content.find(p => p.type === "text");
        msg.content = textPart ? textPart.text : (msg.displayContent || "");
      }
    }
  }

  if (modified) {
    saveChatsToStorage();
    console.log("[RoroGPT] Successfully migrated legacy image attachments and model metadata.");
  }
  return modified;
}

function revokeUnusedObjectUrls() {
  const composerBlobIds = new Set(state.attachments.map(a => a.blobId).filter(Boolean));
  for (const [blobId, url] of activeObjectUrls.entries()) {
    if (!composerBlobIds.has(blobId)) {
      revokeObjectUrl(blobId);
    }
  }
}

async function loadSavedChats() {
  try {
    const raw = localStorage.getItem("roro_chats");
    if (raw) {
      state.chats = JSON.parse(raw);
    }
  } catch {
    state.chats = {};
  }

  try {
    await migrateLegacyChats();
  } catch (e) {
    console.warn("Legacy chat migration notice:", e);
  }

  updateStorageStatusUI();

  const lastActive = localStorage.getItem("roro_last_active_chat");
  if (lastActive && state.chats[lastActive]) {
    loadChat(lastActive);
  } else {
    createNewChat();
  }
}

function createNewChat() {
  const chatId = "chat_" + Date.now();
  state.chats[chatId] = {
    id: chatId,
    title: "New Conversation",
    createdAt: Date.now(),
    model: state.activeModel,
    provider: state.activeProvider || inferProvider(state.activeModel),
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
  revokeUnusedObjectUrls();
  state.currentChatId = chatId;
  try {
    localStorage.setItem("roro_last_active_chat", chatId);
  } catch {}

  const chat = state.chats[chatId];
  if (chat.model && isAllowedModel(chat.model)) {
    state.activeModel = chat.model;
    state.activeProvider = chat.provider || inferProvider(chat.model);
    try {
      localStorage.setItem("roro_active_model", chat.model);
      localStorage.setItem("roro_active_provider", state.activeProvider);
    } catch {}
    updateActiveModelUI(chat.model, state.activeProvider);
  }

  renderMessages(chat.messages);
  renderConversationsSidebar();

  // If mobile, auto-close sidebar
  if (window.innerWidth <= 768) {
    closeMobileSidebar();
  }
}

function updateModalBodyScroll() {
  const anyModalOpen = !!document.querySelector(".modal-backdrop.open");
  if (document.body) {
    document.body.classList.toggle("modal-open", anyModalOpen);
  }
}

function closeMobileSidebar() {
  if (DOM.sidebar) {
    DOM.sidebar.classList.remove("open");
  }
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.remove("active");
  }
  if (document.body) {
    document.body.classList.remove("sidebar-open");
  }
  if (DOM.menuToggleBtn) {
    DOM.menuToggleBtn.setAttribute("aria-expanded", "false");
  }
}

function openMobileSidebar() {
  if (DOM.sidebar) {
    DOM.sidebar.classList.add("open");
  }
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.add("active");
  }
  if (document.body) {
    document.body.classList.add("sidebar-open");
  }
  if (DOM.menuToggleBtn) {
    DOM.menuToggleBtn.setAttribute("aria-expanded", "true");
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

function createReasoningBoxElement(reasoningText) {
  const box = document.createElement("div");
  box.className = "reasoning-box";

  const header = document.createElement("div");
  header.className = "reasoning-header";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = `💭 Thinking Process (${reasoningText.length} chars)`;

  const toggleSpan = document.createElement("span");
  toggleSpan.className = "reason-toggle-icon";
  toggleSpan.textContent = "▼";

  header.append(titleSpan, toggleSpan);

  const content = document.createElement("div");
  content.className = "reasoning-content";
  content.textContent = reasoningText;

  header.addEventListener("click", () => {
    box.classList.toggle("collapsed");
    toggleSpan.textContent = box.classList.contains("collapsed") ? "▶" : "▼";
  });

  box.append(header, content);
  return box;
}

function renderConversationsSidebar() {
  const searchTerm = (DOM.searchChatsInput?.value || "").toLowerCase().trim();
  if (DOM.conversationsList) DOM.conversationsList.replaceChildren();

  const chatIds = Object.keys(state.chats).sort((a, b) => state.chats[b].createdAt - state.chats[a].createdAt);

  chatIds.forEach(id => {
    const chat = state.chats[id];
    if (searchTerm && !chat.title.toLowerCase().includes(searchTerm)) {
      return;
    }

    const isActive = id === state.currentChatId;
    const item = document.createElement("div");
    item.className = `chat-item ${isActive ? "active" : ""}`;

    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-item-title";
    titleSpan.textContent = chat.title || "Untitled";

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "chat-item-actions";

    const delBtn = document.createElement("button");
    delBtn.className = "chat-action-btn delete-btn";
    delBtn.title = "Delete chat";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", "3 6 5 6 21 6");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2");

    svg.append(polyline, path);
    delBtn.appendChild(svg);
    actionsDiv.appendChild(delBtn);

    item.append(titleSpan, actionsDiv);

    item.addEventListener("click", () => loadChat(id));
    delBtn.addEventListener("click", (e) => deleteChat(id, e));

    if (DOM.conversationsList) DOM.conversationsList.appendChild(item);
  });
}

// ==========================================================
// RENDERING MESSAGES & CHAT UI
// ==========================================================
function renderMessages(messages) {
  DOM.messagesContainer.replaceChildren();

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

function renderAttachmentUnavailablePlaceholder(container, imgToReplace, name, meta) {
  const badge = document.createElement("span");
  badge.className = "msg-attachment-badge attachment-unavailable";
  const iconSpan = document.createElement("span");
  iconSpan.textContent = "⚠️ ";
  const textSpan = document.createElement("span");
  textSpan.textContent = `Attachment unavailable (${name || "Photo"}${meta ? " • " + meta : ""})`;
  badge.append(iconSpan, textSpan);
  if (imgToReplace && imgToReplace.parentNode === container) {
    container.replaceChild(badge, imgToReplace);
  } else {
    container.appendChild(badge);
  }
}

function appendMessageElement(msg, index) {
  const isUser = msg.role === "user";
  const row = document.createElement("div");
  row.className = `message-row ${isUser ? "user" : "bot"}`;
  row.setAttribute("data-index", index);

  if (!isUser) {
    const avatar = document.createElement("div");
    avatar.className = "avatar bot";
    avatar.title = "RoroGPT";
    const avatarImg = document.createElement("img");
    avatarImg.src = "/logo.jpg";
    avatarImg.alt = "RoroGPT Avatar";
    avatar.appendChild(avatarImg);
    row.appendChild(avatar);
  }

  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = "message-bubble-wrapper";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  // Render attachment chips or image previews in user message bubble
  if (isUser && msg.attachments && msg.attachments.length > 0) {
    const attachContainer = document.createElement("div");
    attachContainer.className = "msg-attachments-container";

    msg.attachments.forEach(att => {
      if (att.type === "image") {
        const rawSrc = (att.previewUrl || att.base64Data || "").trim();
        if (rawSrc && isSafeUrl(rawSrc, true)) {
          const img = document.createElement("img");
          img.src = rawSrc;
          img.className = "msg-attached-img";
          img.alt = att.name || "Attachment";
          img.title = att.name || "Attachment";
          img.setAttribute("data-preview", "true");
          img.addEventListener("click", () => {
            const previewDiv = document.createElement("div");
            previewDiv.style.textAlign = "center";
            const pImg = document.createElement("img");
            pImg.src = rawSrc;
            pImg.style.cssText = "max-width:100%; border-radius:8px;";
            previewDiv.appendChild(pImg);
            openPreviewModal("🖼️ Photo", att.name || "Photo", previewDiv);
          });
          attachContainer.appendChild(img);
        } else if (att.blobId) {
          const img = document.createElement("img");
          img.className = "msg-attached-img loading-thumb";
          img.alt = att.name || "Attachment";
          img.title = att.name || "Attachment";
          attachContainer.appendChild(img);

          getAttachmentBlob(att.blobId).then(rec => {
            if (rec && rec.blob) {
              const url = getObjectUrlForBlob(att.blobId, rec.blob);
              if (url) {
                img.src = url;
                img.classList.remove("loading-thumb");
                img.setAttribute("data-preview", "true");
                img.addEventListener("click", () => {
                  const previewDiv = document.createElement("div");
                  previewDiv.style.textAlign = "center";
                  const pImg = document.createElement("img");
                  pImg.src = url;
                  pImg.style.cssText = "max-width:100%; border-radius:8px;";
                  previewDiv.appendChild(pImg);
                  openPreviewModal("🖼️ Photo", att.name || "Photo", previewDiv);
                });
                return;
              }
            }
            renderAttachmentUnavailablePlaceholder(attachContainer, img, att.name, att.meta);
          }).catch(() => {
            renderAttachmentUnavailablePlaceholder(attachContainer, img, att.name, att.meta);
          });
        } else {
          renderAttachmentUnavailablePlaceholder(attachContainer, null, att.name, att.meta);
        }
      } else {
        const badge = document.createElement("span");
        badge.className = "msg-attachment-badge";
        const iconSpan = document.createElement("span");
        iconSpan.textContent = att.type === "weblink" ? "🔗" : att.type === "skill" ? "⚡" : "📄";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = att.name || "Attachment";
        badge.append(iconSpan, nameSpan);
        attachContainer.appendChild(badge);
      }
    });

    bubble.appendChild(attachContainer);
  }

  // DeepSeek R1 / Reasoning collapsible content
  if (!isUser && msg.reasoning) {
    bubble.appendChild(createReasoningBoxElement(msg.reasoning));
  }

  // User text or assistant markdown
  const bubbleText = document.createElement("div");
  bubbleText.className = "bubble-text";
  if (isUser) {
    let userText = "";
    if (typeof msg.content === "string") {
      userText = msg.displayContent || msg.content;
    } else if (Array.isArray(msg.content)) {
      const textPart = msg.content.find(p => p.type === "text");
      userText = msg.displayContent || (textPart ? textPart.text : "");
    }
    bubbleText.textContent = userText;
  } else {
    bubbleText.innerHTML = renderMarkdown(msg.content);
  }
  bubble.appendChild(bubbleText);
  bubbleWrapper.appendChild(bubble);

  // Message metadata and actions
  const meta = document.createElement("div");
  meta.className = "message-meta";

  if (!isUser) {
    const modelTag = document.createElement("span");
    modelTag.className = "bot-model-tag";
    const rawModel = msg.model || "unknown/legacy";
    const catalogEntry = (state.models || []).find(m => m.id === rawModel);
    const resolvedName = msg.modelName || (catalogEntry ? catalogEntry.name : null);

    if (rawModel === "unknown/legacy") {
      modelTag.textContent = "🤖 Legacy Model";
      modelTag.title = "Generated by an unrecorded model in a previous version";
    } else {
      const displayLabel = resolvedName ? resolvedName : rawModel;
      modelTag.textContent = `🤖 ${displayLabel}`;
      modelTag.title = `Model: ${rawModel}${msg.provider ? ' | Provider: ' + msg.provider : ''}`;
    }
    meta.appendChild(modelTag);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "action-chip-btn copy-msg-btn";
  copyBtn.title = "Copy message";

  const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  copySvg.setAttribute("width", "12");
  copySvg.setAttribute("height", "12");
  copySvg.setAttribute("viewBox", "0 0 24 24");
  copySvg.setAttribute("fill", "none");
  copySvg.setAttribute("stroke", "currentColor");
  copySvg.setAttribute("stroke-width", "2");
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "9"); rect.setAttribute("y", "9"); rect.setAttribute("width", "13"); rect.setAttribute("height", "13"); rect.setAttribute("rx", "2"); rect.setAttribute("ry", "2");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
  copySvg.append(rect, path);

  const copyText = document.createElement("span");
  copyText.textContent = "Copy";
  copyBtn.append(copySvg, copyText);

  copyBtn.addEventListener("click", () => {
    const liveText = msg.content || bubbleText.innerText || "";
    navigator.clipboard.writeText(liveText).then(() => {
      copyText.textContent = "Copied!";
      setTimeout(() => { copyText.textContent = "Copy"; }, 1500);
    });
  });
  actions.appendChild(copyBtn);

  if (!isUser) {
    const speakBtn = document.createElement("button");
    speakBtn.className = "action-chip-btn speak-msg-btn";
    speakBtn.title = "Read Aloud";

    const speakSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    speakSvg.setAttribute("width", "12");
    speakSvg.setAttribute("height", "12");
    speakSvg.setAttribute("viewBox", "0 0 24 24");
    speakSvg.setAttribute("fill", "none");
    speakSvg.setAttribute("stroke", "currentColor");
    speakSvg.setAttribute("stroke-width", "2");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "11 5 6 9 2 9 2 15 6 15 11 19 11 5");
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arc.setAttribute("d", "M19.07 4.93a10 10 0 0 1 0 14.14");
    speakSvg.append(polygon, arc);

    const speakTextSpan = document.createElement("span");
    speakTextSpan.textContent = "Speak";
    speakBtn.append(speakSvg, speakTextSpan);

    speakBtn.addEventListener("click", () => {
      const liveText = msg.content || bubbleText.innerText || "";
      speakText(liveText, speakBtn);
    });
    actions.appendChild(speakBtn);
  }

  meta.appendChild(actions);
  bubbleWrapper.appendChild(meta);
  row.appendChild(bubbleWrapper);
  DOM.messagesContainer.appendChild(row);
}

function scrollToBottom() {
  DOM.chatViewport.scrollTop = DOM.chatViewport.scrollHeight;
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

  // Enforce total document context limit (250,000 characters)
  if (contextDocs.length > 250000) {
    contextDocs = contextDocs.slice(0, 250000) + "\n\n[...Combined document context truncated to 250,000 characters to fit context limits...]\n";
  }

  const promptText = (contextDocs ? contextDocs + "\n\n--- [USER QUESTION] ---\n" : "") + (text || "Please review and process the attached files.");

  const attachmentsSnapshot = state.attachments.map(att => {
    const { base64Data, ...rest } = att;
    return rest;
  });

  // Add User Message (Plain string content and lightweight metadata attachments only; no base64 in local state)
  const userMsg = {
    role: "user",
    content: promptText,
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

  // Capture request metadata upfront before asynchronous dispatch
  const turnModel = state.activeModel;
  const turnProvider = state.activeProvider || inferProvider(turnModel);
  const catalogEntry = (state.models || []).find(m => m.id === turnModel);
  const turnModelName = catalogEntry ? catalogEntry.name : turnModel.split("/").pop().replace(":free", "");

  // Create Bot Message container with immutable turn-level model metadata
  const botMsg = {
    role: "assistant",
    content: "",
    reasoning: "",
    model: turnModel,
    provider: turnProvider,
    modelName: turnModelName
  };
  currentChat.messages.push(botMsg);
  const botIndex = currentChat.messages.length - 1;

  appendMessageElement(botMsg, botIndex);
  const botRow = DOM.messagesContainer.querySelector(`[data-index="${botIndex}"]`);
  const bubbleText = botRow.querySelector(".bubble-text");
  const dot = document.createElement("span");
  dot.className = "pulsing-dot";
  bubbleText.replaceChildren(dot);

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
    if (turnModel.includes("r1")) {
      genText.textContent = `DeepSeek R1 reasoning (${elapsedSeconds}s)... (Thinking models solve complex steps first)`;
    } else {
      genText.textContent = `RoroGPT is replying (${elapsedSeconds}s)...`;
    }
  }, 1000);

  try {
    const chatHeaders = { "Content-Type": "application/json" };
    if (state.appToken) {
      chatHeaders["x-app-token"] = state.appToken;
    }

    // Build outbound messages with temporary multimodal vision parts if image attachments are present
    const outboundMessages = await Promise.all(
      currentChat.messages.slice(0, -1).map(async (m) => {
        if (m.role === "user" && Array.isArray(m.attachments)) {
          const photos = m.attachments.filter(a => a.type === "image");
          if (photos.length > 0) {
            const imageParts = [];
            for (const p of photos) {
              let dataUrl = "";
              if (p.blobId) {
                const rec = await getAttachmentBlob(p.blobId);
                if (rec && rec.blob) {
                  dataUrl = await blobToDataUrl(rec.blob);
                }
              } else if (p.base64Data) {
                dataUrl = p.base64Data;
              }
              if (dataUrl) {
                imageParts.push({
                  type: "image_url",
                  image_url: { url: dataUrl }
                });
              }
            }
            if (imageParts.length > 0) {
              const textContent = typeof m.content === "string" ? m.content : (m.displayContent || "");
              return {
                role: m.role,
                content: [
                  { type: "text", text: textContent },
                  ...imageParts
                ]
              };
            }
          }
        }
        return { role: m.role, content: m.content };
      })
    );

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: chatHeaders,
      body: JSON.stringify({
        provider: turnProvider,
        messages: outboundMessages,
        model: turnModel,
        systemPrompt: state.systemPrompt,
        skillPrompt: state.activeSkill ? state.activeSkill.instructions : "",
        temperature: state.temperature,
        apiKey: state.apiKey,
        appToken: state.appToken
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
      const scheduleFn = typeof requestAnimationFrame === "function" 
        ? requestAnimationFrame 
        : (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function" 
            ? window.requestAnimationFrame 
            : (cb) => setTimeout(cb, 0));
      scheduleFn(() => {
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

    if (buffer.trim().startsWith("data: ")) {
      const payload = buffer.trim().slice(6);
      if (payload !== "[DONE]") {
        try {
          const data = JSON.parse(payload);
          if (data.reasoning) {
            botMsg.reasoning += data.reasoning;
            updateReasoningBox(botRow, botMsg.reasoning);
          }
          if (data.content) {
            botMsg.content += data.content;
          }
        } catch {}
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
    box = createReasoningBoxElement(reasoningText);
    const bubble = row.querySelector(".message-bubble");
    if (bubble) bubble.insertBefore(box, bubble.firstChild);
  } else {
    const headerTitle = box.querySelector(".reasoning-header span");
    if (headerTitle) headerTitle.textContent = `💭 Thinking Process (${reasoningText.length} chars)`;
    const content = box.querySelector(".reasoning-content");
    if (content) content.textContent = reasoningText;
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
      const span = copyBtn.querySelector("span");
      if (span) span.textContent = "✓ Copied!";
      copyBtn.style.color = "#10b981";
      setTimeout(() => {
        if (span) span.textContent = "Copy";
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

  // Sidebar toggle & backdrop (Instant appear / disappear with scroll locking)
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  DOM.menuToggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      if (DOM.sidebar.classList.contains("open")) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    } else {
      DOM.sidebar.classList.toggle("hidden");
    }
  });
  DOM.closeSidebarBtn.addEventListener("click", () => {
    closeMobileSidebar();
    DOM.sidebar.classList.add("hidden");
  });
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      closeMobileSidebar();
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
    DOM.modelPillBtn.setAttribute("aria-expanded", DOM.modelPillContainer.classList.contains("open") ? "true" : "false");
  });
  DOM.inputModelChip.addEventListener("click", () => {
    DOM.modelPillContainer.classList.add("open");
    DOM.modelPillBtn.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => {
    if (!DOM.modelPillContainer.contains(e.target)) {
      DOM.modelPillContainer.classList.remove("open");
      DOM.modelPillBtn.setAttribute("aria-expanded", "false");
    }
    if (!DOM.themeDropdownContainer.contains(e.target)) {
      DOM.themeDropdownContainer.classList.remove("open");
      DOM.themePickerBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Theme dropdown toggle
  DOM.themePickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.themeDropdownContainer.classList.toggle("open");
    DOM.themePickerBtn.setAttribute("aria-expanded", DOM.themeDropdownContainer.classList.contains("open") ? "true" : "false");
  });
  DOM.themeOpts.forEach(btn => {
    btn.addEventListener("click", () => {
      setTheme(btn.getAttribute("data-theme"));
      DOM.themeDropdownContainer.classList.remove("open");
      DOM.themePickerBtn.setAttribute("aria-expanded", "false");
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
  DOM.openSettingsBtn.addEventListener("click", () => {
    closeMobileSidebar();
    openSettingsModal();
    updateModalBodyScroll();
  });
  DOM.openEmbeddingsBtn.addEventListener("click", () => {
    closeMobileSidebar();
    DOM.embeddingsModal.classList.add("open");
    updateModalBodyScroll();
  });
  DOM.openCustomModelModal.addEventListener("click", () => {
    closeMobileSidebar();
    DOM.modelPillContainer.classList.remove("open");
    DOM.embeddingsModal.classList.add("open");
    updateModalBodyScroll();
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      const modal = document.getElementById(modalId);
      if (modal) {
        if (modalId === "cameraModal" && typeof closeCameraModal === "function") {
          closeCameraModal();
        } else {
          modal.classList.remove("open");
        }
      }
      updateModalBodyScroll();
    });
  });

  // Generic modal-backdrop click to close (when tapping outside modal dialog)
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        if (backdrop.id === "cameraModal" && typeof closeCameraModal === "function") {
          closeCameraModal();
        } else {
          backdrop.classList.remove("open");
        }
        updateModalBodyScroll();
      }
    });
  });

  // MutationObserver to ensure body.modal-open stays strictly synchronized
  if (typeof MutationObserver !== "undefined") {
    const modalObserver = new MutationObserver(() => {
      updateModalBodyScroll();
    });
    document.querySelectorAll(".modal-backdrop").forEach(el => {
      modalObserver.observe(el, { attributes: true, attributeFilter: ["class"] });
    });
  }

  // Settings Save
  DOM.saveSettingsBtn.addEventListener("click", () => {
    state.apiKey = DOM.apiKeyInput.value.trim();
    if (DOM.appTokenInput) {
      state.appToken = DOM.appTokenInput.value.trim();
      localStorage.setItem("roro_app_token", state.appToken);
    }
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

  // App Token visibility toggle
  if (DOM.toggleAppTokenVisibility && DOM.appTokenInput) {
    DOM.toggleAppTokenVisibility.addEventListener("click", () => {
      const isPass = DOM.appTokenInput.type === "password";
      DOM.appTokenInput.type = isPass ? "text" : "password";
      DOM.toggleAppTokenVisibility.textContent = isPass ? "🔒" : "👁️";
    });
  }

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
      if (DOM.modelPillContainer) {
        DOM.modelPillContainer.classList.remove("open");
        if (DOM.modelPillBtn) DOM.modelPillBtn.setAttribute("aria-expanded", "false");
      }
      if (DOM.themeDropdownContainer) {
        DOM.themeDropdownContainer.classList.remove("open");
        if (DOM.themePickerBtn) DOM.themePickerBtn.setAttribute("aria-expanded", "false");
      }

      const openModals = document.querySelectorAll(".modal-backdrop.open");
      if (openModals.length > 0) {
        openModals.forEach(modal => {
          if (modal.id === "cameraModal" && typeof closeCameraModal === "function") {
            closeCameraModal();
          } else {
            modal.classList.remove("open");
          }
        });
        updateModalBodyScroll();
      } else {
        closeMobileSidebar();
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
      closeMobileSidebar();
      if (DOM.skillModal) {
        DOM.skillModal.classList.add("open");
        updateModalBodyScroll();
      }
    });
  }

  // Action 4: Take a Photo
  if (DOM.actionTakePhoto) {
    DOM.actionTakePhoto.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      closeMobileSidebar();
      openCameraModal();
    });
  }

  // Action 5: Add a Website Link
  if (DOM.actionAddWebLink) {
    DOM.actionAddWebLink.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      closeMobileSidebar();
      if (DOM.webLinkStatusBox) DOM.webLinkStatusBox.style.display = "none";
      if (DOM.webLinkModal) {
        DOM.webLinkModal.classList.add("open");
        updateModalBodyScroll();
      }
    });
  }

  // Action 6 & Sidebar: Personal Library
  if (DOM.actionOpenLibrary) {
    DOM.actionOpenLibrary.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAttachMenu();
      closeMobileSidebar();
      loadLibrary();
      if (DOM.libraryModal) {
        DOM.libraryModal.classList.add("open");
        updateModalBodyScroll();
      }
    });
  }
  if (DOM.openLibraryBtn) {
    DOM.openLibraryBtn.addEventListener("click", () => {
      closeMobileSidebar();
      loadLibrary();
      if (DOM.libraryModal) {
        DOM.libraryModal.classList.add("open");
        updateModalBodyScroll();
      }
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

  // Storage Clean Orphaned Blobs
  if (DOM.cleanOrphanBlobsBtn) {
    DOM.cleanOrphanBlobsBtn.addEventListener("click", async () => {
      DOM.cleanOrphanBlobsBtn.disabled = true;
      DOM.cleanOrphanBlobsBtn.textContent = "Cleaning...";
      try {
        const res = await cleanupOrphanedBlobs();
        showToast(`Orphan cleanup complete: Removed ${res.cleaned} unused attachments (${res.remaining} active).`, "success");
      } catch (err) {
        showToast(`Cleanup failed: ${err.message}`, "error");
      } finally {
        DOM.cleanOrphanBlobsBtn.disabled = false;
        DOM.cleanOrphanBlobsBtn.textContent = "🧹 Clean Orphaned Attachments";
      }
    });
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
  if (typeof closeMobileSidebar === "function") closeMobileSidebar();
  DOM.apiKeyInput.value = state.apiKey;
  if (DOM.appTokenInput) DOM.appTokenInput.value = state.appToken || "";
  DOM.systemPromptInput.value = state.systemPrompt;
  DOM.temperatureSlider.value = state.temperature;
  DOM.temperatureValue.textContent = state.temperature;
  updateStorageStatusUI();
  DOM.settingsModal.classList.add("open");
  if (typeof updateModalBodyScroll === "function") updateModalBodyScroll();
}

function exportConversation() {
  const current = state.chats[state.currentChatId];
  if (!current || current.messages.length === 0) {
    showToast("No messages to export", "info");
    return;
  }
  const currentModel = current.model || DEFAULT_CHAT_MODEL;
  const currentProvider = current.provider || inferProvider(currentModel);
  let md = `# ${current.title}\n*Exported from RoroGPT on ${new Date().toLocaleString()}*\n*Current Selected Model: ${currentModel} (Provider: ${currentProvider})*\n*Chat ID: ${current.id}*\n\n---\n\n`;

  const usedModels = new Set();
  (current.messages || []).forEach(m => {
    if (m.role === "assistant" && m.model) {
      usedModels.add(`${m.model}${m.provider ? " (" + m.provider + ")" : ""}`);
    }
  });
  if (usedModels.size > 0) {
    md += `**Model History:** ${Array.from(usedModels).join(", ")}\n\n---\n\n`;
  }

  current.messages.forEach(m => {
    if (m.role === "user") {
      md += `### 👤 You\n\n`;
    } else {
      const modelLabel = m.model || "unknown/legacy";
      const providerLabel = m.provider ? ` • Provider: ${m.provider}` : "";
      md += `### 🤖 RoroGPT (${modelLabel}${providerLabel})\n\n`;
    }
    if (m.reasoning) {
      md += `> **Thinking Process:**\n> ${m.reasoning.replace(/\n/g, "\n> ")}\n\n`;
    }
    md += `${m.content}\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeExportTitle = (current.title || "conversation").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase().slice(0, 36);
  a.download = `${safeExportTitle}_export.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Conversation exported as Markdown", "success");
}

function exportConversationJSON() {
  const current = state.chats[state.currentChatId];
  if (!current || current.messages.length === 0) {
    showToast("No messages to export", "info");
    return;
  }
  const currentModel = current.model || DEFAULT_CHAT_MODEL;
  const currentProvider = current.provider || inferProvider(currentModel);
  const exportChatData = {
    id: current.id,
    title: current.title,
    createdAt: current.createdAt,
    model: currentModel,
    provider: currentProvider,
    messages: (current.messages || []).map(m => {
      const cleanMsg = {
        role: m.role,
        content: m.content
      };
      if (m.reasoning) cleanMsg.reasoning = m.reasoning;
      if (m.role === "assistant") {
        cleanMsg.model = m.model || "unknown/legacy";
        cleanMsg.provider = m.provider || "unknown";
        if (m.modelName) cleanMsg.modelName = m.modelName;
      }
      if (Array.isArray(m.attachments)) {
        cleanMsg.attachments = m.attachments.map(att => {
          const { base64Data, previewUrl, ...safeAtt } = att;
          return safeAtt;
        });
      }
      return cleanMsg;
    })
  };
  const jsonStr = JSON.stringify(exportChatData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeExportTitle = (current.title || "conversation").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase().slice(0, 36);
  a.download = `${safeExportTitle}_export.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Conversation exported as JSON", "success");
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
