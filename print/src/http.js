// Network helpers. Electron's net.fetch goes through Chromium's network stack,
// so system proxy settings apply; plain fetch is the fallback for tests in Node.
let netFetch = globalThis.fetch;
try {
  const { net } = require("electron");
  if (net && net.fetch) netFetch = net.fetch.bind(net);
} catch { /* running outside Electron */ }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gazeta/1.0 (RSS reader)";

async function request(url, { timeout = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await netFetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...headers },
      redirect: "follow",
    });
    return res;
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "нет ответа" : "нет соединения");
  } finally {
    clearTimeout(timer);
  }
}

function charsetOf(contentType, head) {
  const m = /charset=["']?([\w-]+)/i.exec(contentType || "") || /encoding=["']([\w-]+)["']/i.exec(head);
  return m ? m[1].toLowerCase() : "utf-8";
}

async function fetchText(url, opts) {
  const res = await request(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 200));
  let decoder;
  try { decoder = new TextDecoder(charsetOf(res.headers.get("content-type"), head)); }
  catch { decoder = new TextDecoder("utf-8"); }
  return decoder.decode(buf);
}

async function fetchJson(url, opts) {
  const res = await request(url, opts);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

module.exports = { fetchText, fetchJson, UA };
