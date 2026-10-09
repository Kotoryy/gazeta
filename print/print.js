// Prints the issue on GitHub's servers (workflow .github/workflows/print.yml in
// the site repository) — the site stays fresh while the computer is off.
// Lives in the site repository as print/print.js next to a copy of src/ and app/.
const fs = require("fs");
const path = require("path");
const defaults = require("./src/defaults");
const { buildIssue } = require("./src/issue");
const { buildWebEdition } = require("./src/webexport");

const site = path.join(__dirname, "..");
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } };

const saved = readJson(path.join(__dirname, "settings.json"), {});
const cfg = {
  ...defaults,
  ...saved,
  jobs: { ...defaults.jobs, ...saved.jobs },
  market: { ...defaults.market, ...saved.market },
  weather: { ...defaults.weather, ...saved.weather },
  muted: { sources: [], words: [], ...saved.muted },
};

(async () => {
  const prev = readJson(path.join(site, "issue.json"), null);
  // hh.ru, Юла and Авито need a real browser at home: their part of the paper
  // is carried over from the last issue printed by the app.
  const jobs = { ...cfg.jobs, sources: { ...cfg.jobs.sources, hh: false } };
  const { issue, networkDown } = await buildIssue(cfg, { prev, jobs });
  if (networkDown) {
    console.log("Ленты не ответили — выпуск на сайте оставлен прежним.");
    return;
  }
  issue.printedBy = "server";
  fs.writeFileSync(path.join(site, "issue.json"), JSON.stringify(issue));
  fs.writeFileSync(path.join(site, "index.html"), buildWebEdition(issue, { site: true }), "utf8");
  const n = issue.sections.reduce((k, s) => k + s.items.length, 0);
  console.log(`Выпуск напечатан: ${n} заметок, погода ${issue.weather ? "есть" : "нет"}, курсы ${issue.rates ? "есть" : "нет"}.`);
  for (const s of issue.sections) if (s.errors.length) console.log(`  ${s.title}: ${s.errors.join("; ")}`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
