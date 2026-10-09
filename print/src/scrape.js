// Loads a regular web page in a hidden window and runs an extractor script in
// it. Used for sites that have no open API (hh.ru, Юла, Авито).

let running = 0;
const queue = [];
const MAX_PARALLEL = 2;

function acquire() {
  if (running < MAX_PARALLEL) { running++; return Promise.resolve(); }
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  const next = queue.shift();
  if (next) next(); else running--;
}

// extract: JS expression string evaluated in the page; it must return
// { items: [...], ready: bool } or { blocked: "reason" }.
// gate: an object shared by the requests to one site; once the site blocks us
// (captcha, VPN check), the remaining requests give up at once.
async function scrapePage(url, extract, { partition = "persist:scrape", timeout = 35000, settle = 4, gate = null } = {}) {
  await acquire();
  try {
    if (gate?.error) throw gate.error;
    return await load(url, extract, partition, timeout, settle);
  } catch (e) {
    if (gate && e.blocked) gate.error = e;
    throw e;
  } finally {
    release();
  }
}

function load(url, extract, partition, timeout, settle) {
  const { BrowserWindow, session } = require("electron");
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        session: session.fromPartition(partition),
        contextIsolation: true,
        sandbox: true,
      },
    });
    let done = false;
    let status = 200;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!win.isDestroyed()) win.destroy();
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => finish(new Error("нет ответа")), timeout);
    win.webContents.setAudioMuted(true);
    win.webContents.on("did-navigate", (_e, _url, code) => { status = code; });
    win.webContents.on("did-fail-load", (_e, code, desc, _u, isMain) => {
      if (isMain && code !== -3) finish(new Error(desc || `ошибка ${code}`));
    });
    win.webContents.on("did-finish-load", async () => {
      // Client-side rendered pages need a few chances to put the cards on the page.
      for (let i = 0; i < 16 && !done; i++) {
        try {
          const r = await win.webContents.executeJavaScript(extract);
          if (r.blocked) return finish(Object.assign(new Error(r.blocked), { blocked: true }));
          if (r.items.length && i >= 1) return finish(null, r.items);
          if (r.ready && i >= settle) return finish(null, r.items);
        } catch { /* page still navigating */ }
        await new Promise((s) => setTimeout(s, 800));
      }
      if (status >= 400) return finish(new Error(`HTTP ${status}`));
      finish(null, []);
    });
    win.loadURL(url).catch(() => {});
  });
}

module.exports = { scrapePage };
