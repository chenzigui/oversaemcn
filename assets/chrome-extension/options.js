import { deriveRelayToken, fetchGatewayConfig } from './background-utils.js'
import { classifyRelayCheckException, classifyRelayCheckResponse } from './options-validation.js'

const DEFAULT_PORT = 18792

function clampPort(value) {
  const n = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(n)) return DEFAULT_PORT
  if (n <= 0 || n > 65535) return DEFAULT_PORT
  return n
}

function updateRelayUrl(host, port) {
  const el = document.getElementById('relay-url')
  if (!el) return
  const h = String(host || '127.0.0.1').trim()
  const p = Number.isFinite(port) ? port : DEFAULT_PORT
  const scheme = h === '127.0.0.1' || h === 'localhost' ? 'http' : 'https'
  el.textContent = `${scheme}://${h}:${p}/`
}

function setStatus(kind, message) {
  const status = document.getElementById('status')
  if (!status) return
  status.dataset.kind = kind || ''
  status.textContent = message || ''
}

async function checkRelayReachable(host, port, token) {
  const h = String(host || '127.0.0.1').trim()
  const scheme = h === '127.0.0.1' || h === 'localhost' ? 'http' : 'https'
  const url = `${scheme}://${h}:${port}/json/version`
  const trimmedToken = String(token || '').trim()
  if (!trimmedToken) {
    setStatus('error', 'Gateway token required. Save your gateway token to connect.')
    return
  }
  try {
    const relayToken = await deriveRelayToken(trimmedToken, Number(port))
    // Delegate the fetch to the background service worker to bypass
    // CORS preflight on the custom x-openclaw-relay-token header.
    const res = await chrome.runtime.sendMessage({
      type: 'relayCheck',
      url,
      token: relayToken,
    })
    const result = classifyRelayCheckResponse(res, Number(port))
    if (result.action === 'throw') throw new Error(result.error)
    setStatus(result.kind, result.message)
  } catch (err) {
    const result = classifyRelayCheckException(err, Number(port))
    setStatus(result.kind, result.message)
  }
}

async function load() {
  const stored = await chrome.storage.local.get(['relayPort', 'relayHost', 'gatewayToken'])
  const hasHost = !!String(stored.relayHost || '').trim()
  const hasPort = stored.relayPort !== undefined && stored.relayPort !== ''
  let host, port
  const cfg = await fetchGatewayConfig()
  host = hasHost ? String(stored.relayHost).trim() : cfg.host
  port = hasPort ? clampPort(stored.relayPort) : cfg.port
  const token = String(stored.gatewayToken || '').trim()
  const hostEl = document.getElementById('host')
  const portEl = document.getElementById('port')
  if (hostEl) hostEl.value = host
  if (portEl) portEl.value = port ? String(port) : ''
  document.getElementById('token').value = token
  updateRelayUrl(host, port)
  await checkRelayReachable(host, port, token)
}

async function save() {
  const hostInput = document.getElementById('host')
  const portInput = document.getElementById('port')
  const tokenInput = document.getElementById('token')
  const hostRaw = hostInput ? String(hostInput.value || '').trim() : ''
  const portRaw = portInput ? portInput.value : ''
  let host = hostRaw || '127.0.0.1'
  let port = clampPort(portRaw)
  if (!portRaw) {
    const cfg = await fetchGatewayConfig()
    port = cfg.port
  }
  await chrome.storage.local.set({
    relayHost: hostRaw || undefined,
    relayPort: portRaw ? port : undefined,
    gatewayToken: String(tokenInput.value || '').trim(),
  })
  if (hostInput) hostInput.value = hostRaw || host
  if (portInput) portInput.value = String(port)
  tokenInput.value = String(tokenInput.value || '').trim()
  updateRelayUrl(host, port)
  await checkRelayReachable(host, port, tokenInput.value)
}

document.getElementById('save').addEventListener('click', () => void save())
void load()
