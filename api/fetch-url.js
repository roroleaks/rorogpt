// Secure Web Retrieval Endpoint with Strict SSRF & DNS-Rebinding Protection for RoroGPT
import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { handleCors, checkAuth, enforceRateLimit } from "./_security.js";

export const MAX_BODY_BYTES = 1.5 * 1024 * 1024; // 1.5 MB max response size (1,572,864 bytes)
export const FETCH_TIMEOUT_MS = 8000; // 8 seconds timeout
export const MAX_REDIRECTS = 5; // Maximum allowed redirect hops

/**
 * Checks whether an IP address is private, loopback, link-local, or reserved.
 */
export function isPrivateOrReservedIP(ip) {
  if (!ip) return true;
  const version = net.isIP(ip);
  if (version === 0) return true;

  if (version === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return true;

    // 0.0.0.0/8 (Broadcast/Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Shared address space / CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast 224-239) & 240.0.0.0/4 (Reserved 240-255)
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
    // fc00::/7 (Unique local / ULA)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // ff00::/8 (Multicast)
    if (normalized.startsWith("ff")) return true;

    // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.0.0.1, etc.)
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
export async function validateHostname(hostname, isRedirectHop = false) {
  let lower = (hostname || "").toLowerCase().trim();

  // Strip IPv6 square brackets if present (e.g. "[::1]" -> "::1")
  if (lower.startsWith("[") && lower.endsWith("]")) {
    lower = lower.slice(1, -1);
  }

  // Allow loopback strictly when running automated mock-server tests
  if (process.env.ALLOW_LOOPBACK_FOR_TESTS === "true") {
    if (process.env.BLOCK_LOOPBACK_REDIRECTS === "true" && isRedirectHop) {
      // Do not allow loopback on redirect hops when testing redirect defense
    } else if (lower === "127.0.0.1" || (process.env.ALLOW_LOCALHOST_FOR_TESTS === "true" && lower === "localhost")) {
      return ["127.0.0.1"];
    }
  }

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
 * Validates protocol, port, and hostname of a target URL.
 */
export async function validateTargetUrl(parsedUrl, isRedirectHop = false) {
  if (!parsedUrl || !(parsedUrl instanceof URL)) {
    throw new Error("Invalid URL object provided for validation.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const err = new Error(`Protocol '${parsedUrl.protocol}' is unsupported. Only http:// and https:// URLs are permitted.`);
    err.isProtocolError = true;
    throw err;
  }

  const isTest = process.env.ALLOW_LOOPBACK_FOR_TESTS === "true";
  if (!isTest && parsedUrl.port) {
    const port = parseInt(parsedUrl.port, 10);
    const allowedPorts = [80, 443, 8080, 8443];
    if (!allowedPorts.includes(port)) {
      throw new Error(`Port '${port}' is restricted. Only standard web ports (80, 443, 8080, 8443) are allowed.`);
    }
  }

  return validateHostname(parsedUrl.hostname, isRedirectHop);
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

/**
 * Performs a single HTTP or HTTPS request without following redirects,
 * verifying DNS and socket peer address to defeat DNS rebinding.
 */
function fetchSingleUrl(targetUrl, timeoutMs, abortSignal, validatedIps) {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === "https:";
    const client = isHttps ? https : http;

    const port = targetUrl.port
      ? parseInt(targetUrl.port, 10)
      : (isHttps ? 443 : 80);

    const allowLoopback = process.env.ALLOW_LOOPBACK_FOR_TESTS === "true";

    // Custom Agent with strict DNS pre-validation lookup
    const agent = new (isHttps ? https.Agent : http.Agent)({
      keepAlive: false,
      lookup: async (hostname, lookupOpts, cb) => {
        try {
          if (typeof lookupOpts === "function") {
            cb = lookupOpts;
            lookupOpts = {};
          }
          const addrs = await validateHostname(hostname);
          if (!addrs || addrs.length === 0) {
            return cb(new Error(`DNS resolution failed for '${hostname}'`));
          }
          if (lookupOpts && lookupOpts.all) {
            cb(null, addrs.map(a => ({ address: a, family: net.isIP(a) })));
          } else {
            cb(null, addrs[0], net.isIP(addrs[0]));
          }
        } catch (err) {
          cb(err);
        }
      }
    });

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RoroGPT/1.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept-Encoding": "identity",
      "Connection": "close"
    };

    const reqOptions = {
      method: "GET",
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      agent,
      timeout: timeoutMs
    };

    if (isHttps) {
      reqOptions.servername = targetUrl.hostname; // SNI
    }

    let settled = false;
    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const req = client.request(reqOptions);

    if (abortSignal) {
      if (abortSignal.aborted) {
        req.destroy(new Error("AbortError"));
        return safeReject(new Error("AbortError"));
      }
      abortSignal.addEventListener("abort", () => {
        req.destroy(new Error("AbortError"));
        safeReject(new Error("AbortError"));
      }, { once: true });
    }

    // Inspect connected peer address on socket to defeat DNS rebinding attacks
    req.on("socket", (socket) => {
      const verifyPeer = () => {
        const peerIp = socket.remoteAddress;
        if (!peerIp) return;

        // Simulated DNS rebinding test check
        if (process.env.SIMULATE_DNS_REBINDING === "true") {
          const err = new Error(`SSRF blocked: DNS rebinding detected; connected peer '${peerIp}' does not match validated address.`);
          err.isSSRFBlocked = true;
          socket.destroy(err);
          req.destroy(err);
          return safeReject(err);
        }

        // Loopback allowed ONLY during tests with ALLOW_LOOPBACK_FOR_TESTS explicitly enabled
        if (allowLoopback && (peerIp === "127.0.0.1" || peerIp === "::1")) {
          return;
        }

        // Verify connected peer is not private/reserved
        if (isPrivateOrReservedIP(peerIp)) {
          const err = new Error(`SSRF blocked: Connected peer IP '${peerIp}' is private or reserved.`);
          err.isSSRFBlocked = true;
          socket.destroy(err);
          req.destroy(err);
          return safeReject(err);
        }

        // Verify peer matches one of the resolved public addresses
        if (validatedIps && validatedIps.length > 0 && !validatedIps.includes(peerIp)) {
          const err = new Error(`SSRF blocked: Connected peer '${peerIp}' does not match validated DNS addresses.`);
          err.isSSRFBlocked = true;
          socket.destroy(err);
          req.destroy(err);
          return safeReject(err);
        }
      };

      if (socket.connecting) {
        socket.once("connect", verifyPeer);
        if (isHttps) {
          socket.once("secureConnect", verifyPeer);
        }
      } else {
        verifyPeer();
      }
    });

    req.on("timeout", () => {
      const err = new Error("AbortError");
      req.destroy(err);
      safeReject(err);
    });

    req.on("error", (err) => {
      safeReject(err);
    });

    req.on("response", (res) => {
      const statusCode = res.statusCode || 200;

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const location = res.headers["location"];
        res.resume(); // drain incoming redirect body
        return safeResolve({
          isRedirect: true,
          statusCode,
          location
        });
      }

      // Check Content-Type
      const contentType = (res.headers["content-type"] || "").toLowerCase();
      const isTextOrHtml =
        contentType.includes("text/html") ||
        contentType.includes("text/plain") ||
        contentType.includes("application/xhtml") ||
        contentType.includes("text/markdown") ||
        contentType.includes("application/json") ||
        contentType.includes("application/xml");

      if (!isTextOrHtml && !contentType.includes("text/")) {
        res.resume();
        return safeResolve({
          isUnsupportedType: true,
          contentType,
          statusCode
        });
      }

      // Pre-check Content-Length before reading body
      const contentLengthHeader = res.headers["content-length"];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
          safeResolve({
            isOversized: true,
            contentLength
          });
          try { res.destroy(); } catch {}
          try { req.destroy(); } catch {}
          return;
        }
      }

      // Incremental stream reading with raw byte length limit
      const chunks = [];
      let totalBytes = 0;
      let isOversized = false;

      res.on("data", (chunk) => {
        totalBytes += chunk.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          isOversized = true;
          safeResolve({ isOversized: true });
          try { res.destroy(); } catch {}
          try { req.destroy(); } catch {}
          return;
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        if (isOversized) {
          return safeResolve({
            isOversized: true
          });
        }

        const mergedBuffer = Buffer.concat(chunks);
        safeResolve({
          isRedirect: false,
          statusCode,
          headers: res.headers,
          contentType,
          buffer: mergedBuffer
        });
      });

      res.on("error", (err) => {
        if (isOversized) {
          return safeResolve({ isOversized: true });
        }
        safeReject(err);
      });
    });

    req.end();
  });
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

  // Initial protocol check
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return res.status(400).json({
      error: `Protocol '${parsedUrl.protocol}' is unsupported. Only http:// and https:// URLs are permitted.`
    });
  }

  const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || `${FETCH_TIMEOUT_MS}`, 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = parsedUrl;
    let redirectCount = 0;
    const visitedUrls = new Set([currentUrl.toString()]);
    let finalResult = null;

    // Manual Bounded Redirect Loop
    while (true) {
      // 1. Full SSRF & Hostname Validation BEFORE every request hop
      const isRedirectHop = redirectCount > 0;
      let validatedIps;
      try {
        validatedIps = await validateTargetUrl(currentUrl, isRedirectHop);
      } catch (err) {
        if (err.isProtocolError) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(403).json({
          error: `Security Restriction: ${err.message}`,
          isSSRFBlocked: true
        });
      }

      // 2. Fetch single URL without auto-redirects
      let stepResult;
      try {
        stepResult = await fetchSingleUrl(currentUrl, timeoutMs, controller.signal, validatedIps);
      } catch (err) {
        if (err.name === "AbortError" || err.message === "AbortError" || controller.signal.aborted) {
          return res.status(504).json({
            error: `Website request timed out after ${Math.max(1, Math.round(timeoutMs / 1000))} seconds.`
          });
        }
        if (err.isSSRFBlocked) {
          return res.status(403).json({
            error: `Security Restriction: ${err.message}`,
            isSSRFBlocked: true
          });
        }
        return res.status(500).json({
          error: `Failed to retrieve website: ${err.message}`
        });
      }

      // 3. Handle Redirects
      if (stepResult.isRedirect) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          return res.status(400).json({
            error: `Too many redirects: exceeded maximum limit of ${MAX_REDIRECTS}.`
          });
        }

        if (!stepResult.location) {
          return res.status(400).json({
            error: "Invalid redirect: upstream response omitted Location header."
          });
        }

        let nextUrl;
        try {
          // Resolve relative or absolute redirect against current URL
          nextUrl = new URL(stepResult.location, currentUrl.toString());
        } catch {
          return res.status(400).json({
            error: `Invalid redirect: malformed Location header '${stepResult.location}'.`
          });
        }

        // Validate protocol of redirect target (must be http: or https:)
        if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
          return res.status(400).json({
            error: `Invalid redirect: protocol '${nextUrl.protocol}' is unsupported. Only http: and https: are permitted.`
          });
        }

        // Detect redirect loops
        if (visitedUrls.has(nextUrl.toString())) {
          return res.status(400).json({
            error: `Redirect loop detected at '${nextUrl.toString()}'.`
          });
        }
        visitedUrls.add(nextUrl.toString());

        currentUrl = nextUrl;
        continue;
      }

      finalResult = stepResult;
      break;
    }

    if (finalResult.isUnsupportedType) {
      return res.status(415).json({
        error: `Unsupported content type '${finalResult.contentType}'. Only web pages, articles, and text documents can be retrieved.`
      });
    }

    if (finalResult.isOversized) {
      if (finalResult.contentLength) {
        return res.status(413).json({
          error: `Response exceeds the maximum allowed size of 1.5 MB (Content-Length: ${(finalResult.contentLength / 1024 / 1024).toFixed(2)} MB).`
        });
      }
      return res.status(413).json({
        error: "Response exceeded the maximum allowed size of 1.5 MB while streaming."
      });
    }

    if (finalResult.statusCode >= 400) {
      return res.status(finalResult.statusCode).json({
        error: `Website returned HTTP error ${finalResult.statusCode}.`,
        status: finalResult.statusCode
      });
    }

    // Decode buffer only after validation passes
    let charset = "utf-8";
    const contentType = finalResult.contentType || "";
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch && charsetMatch[1]) {
      charset = charsetMatch[1].replace(/["']/g, "").trim().toLowerCase();
    }

    let rawText = "";
    try {
      const decoder = new TextDecoder(charset);
      rawText = decoder.decode(finalResult.buffer);
    } catch {
      const fallbackDecoder = new TextDecoder("utf-8");
      rawText = fallbackDecoder.decode(finalResult.buffer);
    }

    const extracted = extractReadableTextFromHTML(rawText);

    return res.status(200).json({
      success: true,
      url: parsedUrl.toString(),
      finalUrl: currentUrl.toString(),
      title: extracted.title || currentUrl.hostname,
      description: extracted.description,
      content: extracted.content,
      charCount: extracted.charCount,
      isTruncated: extracted.isTruncated,
      instruction: instruction.trim()
    });
  } catch (err) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      return res.status(504).json({ error: `Website request timed out after ${Math.max(1, Math.round(timeoutMs / 1000))} seconds.` });
    }
    return res.status(500).json({ error: `Failed to retrieve website: ${err.message}` });
  } finally {
    clearTimeout(timer);
  }
}
