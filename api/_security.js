// Security Access Boundary, CORS Allowlist, Rate Limiting & Auth for RoroGPT
import crypto from "node:crypto";

/**
 * ==========================================================
 * 1. SAFE SECURITY HEADERS
 * ==========================================================
 */
export function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()"
  );
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

/**
 * ==========================================================
 * 2. CORS ALLOWLIST & ORIGIN VALIDATION
 * ==========================================================
 */
export function checkOrigin(req) {
  const origin = (req.headers["origin"] || "").trim();
  const allowedConfig = (process.env.ALLOWED_ORIGINS || "").trim();
  const isProd = process.env.NODE_ENV === "production";

  // No Origin header: Same-origin, direct browser navigation, or server-to-server request
  if (!origin) {
    return { allowed: true, origin: null };
  }

  // Explicit ALLOWED_ORIGINS configured
  if (allowedConfig) {
    const list = allowedConfig
      .split(",")
      .map(o => o.trim().toLowerCase())
      .filter(Boolean);
    const reqOriginLower = origin.toLowerCase();
    const isAllowed = list.includes("*") || list.includes(reqOriginLower);
    return { allowed: isAllowed, origin: isAllowed ? origin : null };
  }

  // If ALLOWED_ORIGINS is not set:
  // In development mode, allow localhost and loopback origins
  if (!isProd) {
    try {
      const parsed = new URL(origin);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0"
      ) {
        return { allowed: true, origin };
      }
    } catch {}
    // In dev mode with no config, default to allowing
    return { allowed: true, origin };
  }

  // In production with NO ALLOWED_ORIGINS set:
  // Reject external browser origins to prevent public proxy abuse
  return { allowed: false, origin: null };
}

export function handleCors(req, res, methods = "POST, OPTIONS") {
  applySecurityHeaders(res);
  const { allowed, origin } = checkOrigin(req);

  res.setHeader("Vary", "Origin");

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-App-Token, X-Api-Token"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    if (req.headers["origin"] && !allowed) {
      res.status(403).json({ error: "Forbidden: Origin not allowed by CORS policy." });
      return false;
    }
    res.status(204).end();
    return false;
  }

  if (req.headers["origin"] && !allowed) {
    res.status(403).json({ error: "Forbidden: Origin not allowed by CORS policy." });
    return false;
  }

  return true;
}

/**
 * ==========================================================
 * 3. LIGHTWEIGHT APP AUTHENTICATION (APP_API_TOKEN)
 * ==========================================================
 */
export function checkAuth(req, res) {
  const configuredToken = (process.env.APP_API_TOKEN || "").trim();
  const isProd = process.env.NODE_ENV === "production";

  // In local development mode, if APP_API_TOKEN is not configured, bypass auth
  if (!isProd && !configuredToken) {
    return true;
  }

  // In production mode without APP_API_TOKEN configured, reject to prevent open abuse
  if (isProd && !configuredToken) {
    res.status(401).json({
      error: "Unauthorized: APP_API_TOKEN must be configured in production to secure public API endpoints."
    });
    return false;
  }

  // Extract client token from headers or body
  let providedToken = (
    req.headers["x-app-token"] ||
    req.headers["x-api-token"] ||
    ""
  ).toString().trim();

  if (!providedToken && req.headers["authorization"]) {
    const authHeader = req.headers["authorization"].trim();
    if (authHeader.startsWith("Bearer ")) {
      providedToken = authHeader.slice(7).trim();
    }
  }

  if (!providedToken && req.body && typeof req.body === "object") {
    providedToken = (req.body.appToken || "").toString().trim();
  }

  if (!providedToken) {
    res.status(401).json({
      error: "Unauthorized: Missing APP_API_TOKEN. Pass via 'x-app-token' header or 'appToken' parameter."
    });
    return false;
  }

  // Timing-safe comparison to prevent side-channel timing attacks
  const bufConfigured = Buffer.from(configuredToken);
  const bufProvided = Buffer.from(providedToken);
  const isMatch =
    bufConfigured.length === bufProvided.length &&
    crypto.timingSafeEqual(bufConfigured, bufProvided);

  if (!isMatch) {
    res.status(401).json({
      error: "Unauthorized: Invalid APP_API_TOKEN."
    });
    return false;
  }

  return true;
}

/**
 * ==========================================================
 * 4. BOUNDED IN-MEMORY RATE LIMITER
 * ==========================================================
 * Sliding window rate limiter with LRU-style capacity bound.
 * Prevents unbounded memory growth in long-running processes or serverless warm containers.
 * Note: A shared key-value store (e.g. Upstash Redis) is recommended for distributed multi-instance production.
 */
export class BoundedRateLimiter {
  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  check(key, windowMs, maxRequests) {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      // Enforce bounded size
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }

    entry.count += 1;
    this.store.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    return {
      allowed: entry.count <= maxRequests,
      remaining,
      resetAt: entry.resetAt,
      retryAfter
    };
  }

  clear() {
    this.store.clear();
  }
}

export const rateLimiter = new BoundedRateLimiter(5000);

export function getClientIp(req) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",");
    const firstIp = ips[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp && xRealIp.trim()) return xRealIp.trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

export function enforceRateLimit(req, res, actionType = "chat") {
  const clientIp = getClientIp(req);
  const key = `${actionType}:${clientIp}`;

  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
  const maxRequests = actionType === "chat"
    ? parseInt(process.env.RATE_LIMIT_MAX_CHAT || "30", 10)
    : parseInt(process.env.RATE_LIMIT_MAX_FETCH || "20", 10);

  const result = rateLimiter.check(key, windowMs, maxRequests);

  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    res.setHeader("Retry-After", result.retryAfter);
    res.status(429).json({
      error: "Too many requests. Rate limit exceeded. Please try again later."
    });
    return false;
  }

  return true;
}
