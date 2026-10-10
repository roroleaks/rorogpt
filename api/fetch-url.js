// Secure Web Retrieval Endpoint with Strict SSRF Protection for RoroGPT
import dns from "node:dns/promises";
import net from "node:net";
import { handleCors, checkAuth, enforceRateLimit } from "./_security.js";

const MAX_BODY_BYTES = 1.5 * 1024 * 1024; // 1.5 MB max response size
const FETCH_TIMEOUT_MS = 8000; // 8 seconds timeout

/**
 * Checks whether an IP address is private, loopback, link-local, or reserved.
 */
function isPrivateOrReservedIP(ip) {
  if (!ip) return true;
  const version = net.isIP(ip);
  if (version === 0) return true;

  if (version === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return true;

    // 0.0.0.0/8 (Broadcast)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Shared address space)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224) return true;

    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
    // :: (Unspecified)
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
    // fe80::/10 (Link-local)
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    // fc00::/7 (Unique local)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (normalized.includes("::ffff:")) {
      const v4Part = normalized.split("::ffff:")[1];
      if (v4Part && net.isIPv4(v4Part)) {
        return isPrivateOrReservedIP(v4Part);
      }
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Validates a hostname and ensures its resolved IPs are public.
 */
async function validateHostname(hostname) {
  const lower = (hostname || "").toLowerCase().trim();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower === "metadata.google.internal" ||
    lower === "instance-data"
  ) {
    throw new Error(`Access to internal or local hostname '${hostname}' is prohibited.`);
  }

  // If already an IP address, check directly
  if (net.isIP(lower)) {
    if (isPrivateOrReservedIP(lower)) {
      throw new Error(`Direct connection to private/reserved IP address '${lower}' is blocked.`);
    }
    return [lower];
  }

  // Resolve hostname via DNS
  let addresses = [];
  try {
    const lookup = await dns.lookup(lower, { all: true });
    addresses = lookup.map(l => l.address);
  } catch (err) {
    throw new Error(`DNS lookup failed for '${hostname}': ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No IP addresses found for hostname '${hostname}'.`);
  }

  for (const addr of addresses) {
    if (isPrivateOrReservedIP(addr)) {
      throw new Error(`Resolved address '${addr}' for '${hostname}' is private/restricted.`);
    }
  }

  return addresses;
}

/**
 * Strips script tags, style tags, and extracts readable text from HTML.
 */
function extractReadableTextFromHTML(html) {
  if (!html) return "";

  // Extract Title
  let title = "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/\s+/g, " ").trim();
  }

  // Extract Meta Description
  let description = "";
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  // Remove script, style, noscript, svg, canvas, iframe, nav, footer
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Convert headings and paragraphs to structured text
  clean = clean
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, "\n\n### $2\n\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n* $1")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "\n> $1\n")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<hr\s*[\/]?>/gi, "\n---\n");

  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

  // Collapse multiple blank lines
  clean = clean.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // Limit content length to a generous readable window (~60K chars)
  const MAX_CHAR_LENGTH = 60000;
  let isTruncated = false;
  if (clean.length > MAX_CHAR_LENGTH) {
    clean = clean.slice(0, MAX_CHAR_LENGTH) + "\n\n...[Content truncated for model context limit]...";
    isTruncated = true;
  }

  return { title, description, content: clean, isTruncated, charCount: clean.length };
}

export default async function handler(req, res) {
  if (!handleCors(req, res, "POST, OPTIONS")) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!enforceRateLimit(req, res, "fetch")) {
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  req.body = body;

  if (!checkAuth(req, res)) {
    return;
  }

  const { url: targetUrl, instruction = "" } = body || {};

  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ error: "Target 'url' parameter is required." });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl.trim());
  } catch {
    return res.status(400).json({ error: "Invalid URL format. Please provide a valid HTTP or HTTPS URL." });
  }

  // Protocol check (only HTTP and HTTPS)
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return res.status(400).json({
      error: `Protocol '${parsedUrl.protocol}' is unsupported. Only http:// and https:// URLs are permitted.`
    });
  }

  // SSRF & Hostname Validation
  try {
    await validateHostname(parsedUrl.hostname);
  } catch (err) {
    return res.status(403).json({
      error: `Security Restriction: ${err.message}`,
      isSSRFBlocked: true
    });
  }

  // Fetch with timeout and size limit
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RoroGPT/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });

    clearTimeout(timer);

    // Re-validate final URL in case of redirects
    const finalUrl = new URL(upstream.url);
    await validateHostname(finalUrl.hostname);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Website returned HTTP error ${upstream.status} (${upstream.statusText || "Error"}).`,
        status: upstream.status
      });
    }

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const isTextOrHtml =
      contentType.includes("text/html") ||
      contentType.includes("text/plain") ||
      contentType.includes("application/xhtml") ||
      contentType.includes("text/markdown") ||
      contentType.includes("application/json") ||
      contentType.includes("application/xml");

    if (!isTextOrHtml && !contentType.includes("text/")) {
      return res.status(415).json({
        error: `Unsupported content type '${contentType}'. Only web pages, articles, and text documents can be retrieved.`
      });
    }

    const rawText = await upstream.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return res.status(413).json({
        error: `Web page is too large (${(rawText.length / 1024 / 1024).toFixed(2)} MB). Maximum allowed size is 1.5 MB.`
      });
    }

    const extracted = extractReadableTextFromHTML(rawText);

    return res.status(200).json({
      success: true,
      url: parsedUrl.toString(),
      finalUrl: finalUrl.toString(),
      title: extracted.title || parsedUrl.hostname,
      description: extracted.description,
      content: extracted.content,
      charCount: extracted.charCount,
      isTruncated: extracted.isTruncated,
      instruction: instruction.trim()
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Website request timed out after 8 seconds." });
    }
    return res.status(500).json({ error: `Failed to retrieve website: ${err.message}` });
  }
}
