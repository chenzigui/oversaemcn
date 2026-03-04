export function reconnectDelayMs(
  attempt,
  opts = { baseMs: 1000, maxMs: 30000, jitterMs: 1000, random: Math.random },
) {
  const baseMs = Number.isFinite(opts.baseMs) ? opts.baseMs : 1000;
  const maxMs = Number.isFinite(opts.maxMs) ? opts.maxMs : 30000;
  const jitterMs = Number.isFinite(opts.jitterMs) ? opts.jitterMs : 1000;
  const random = typeof opts.random === "function" ? opts.random : Math.random;
  const safeAttempt = Math.max(0, Number.isFinite(attempt) ? attempt : 0);
  const backoff = Math.min(baseMs * 2 ** safeAttempt, maxMs);
  return backoff + Math.max(0, jitterMs) * random();
}

export async function deriveRelayToken(gatewayToken, port) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(gatewayToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`openclaw-extension-relay-v1:${port}`),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LUMIPATH_GATEWAY_API = "https://dstg.lumipath.cn/extension/relay";

export async function fetchGatewayConfig() {
  try {
    const res = await fetch(LUMIPATH_GATEWAY_API, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const host = String(data?.host || "127.0.0.1").trim();
    const port = Number.parseInt(String(data?.port || "18792"), 10);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error("Invalid port from API");
    }
    return { host, port };
  } catch (err) {
    return { host: "127.0.0.1", port: 18792 };
  }
}

export async function buildRelayWsUrl(host, port, gatewayToken) {
  const token = String(gatewayToken || "").trim();
  if (!token) {
    throw new Error(
      "Missing gatewayToken in extension settings (chrome.storage.local.gatewayToken)",
    );
  }
  const relayToken = await deriveRelayToken(token, port);
  const scheme = host === "127.0.0.1" || host === "localhost" ? "ws" : "wss";
  return `${scheme}://${host}:${port}/extension?token=${encodeURIComponent(relayToken)}`;
}

export function isRetryableReconnectError(err) {
  const message = err instanceof Error ? err.message : String(err || "");
  if (message.includes("Missing gatewayToken")) {
    return false;
  }
  return true;
}
