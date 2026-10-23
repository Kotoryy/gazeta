// The reader's saved settings brought up to the current version and filled in
// with defaults. Shared by the app, `npm run site` and the server press, so all
// three print the same paper.
const defaults = require("./defaults");

function mergeSettings(saved) {
  if (!saved) return structuredClone(defaults);
  saved = structuredClone(saved);
  if ((saved.version || 1) < 2) {
    // v2 added the fishing rubric and the retro console ads.
    const fishing = defaults.sections.find((s) => s.id === "fishing");
    if (saved.sections && !saved.sections.some((s) => s.id === "fishing")) saved.sections.push(structuredClone(fishing));
  }
  if ((saved.version || 1) < 3) {
    // v3 added Telegram channels to the rubrics: add them to the reader's own lists.
    for (const sec of saved.sections || []) {
      const def = defaults.sections.find((d) => d.id === sec.id);
      for (const f of def?.feeds || []) {
        if (/t\.me\//.test(f.url) && !sec.feeds.some((x) => x.url === f.url)) sec.feeds.push({ ...f });
      }
    }
  }
  if ((saved.version || 1) < 4 && saved.sections && !saved.sections.some((s) => s.id === "theatre")) {
    // v4 added the theatre rubric: right after classical music, or at the end.
    const theatre = structuredClone(defaults.sections.find((s) => s.id === "theatre"));
    const at = saved.sections.findIndex((s) => s.id === "classical");
    saved.sections.splice(at >= 0 ? at + 1 : saved.sections.length, 0, theatre);
  }
  return {
    ...structuredClone(defaults),
    ...saved,
    version: defaults.version,
    jobs: { ...defaults.jobs, ...saved.jobs },
    market: { ...defaults.market, ...saved.market, alerts: saved.market?.alerts || [] },
    weather: { ...defaults.weather, ...saved.weather },
    web: { ...defaults.web, ...saved.web },
    reading: { ...defaults.reading, ...saved.reading },
    muted: { sources: [], words: [], ...saved.muted },
    morning: { ...defaults.morning, ...saved.morning },
    links: { ...defaults.links, ...saved.links },
  };
}

module.exports = { mergeSettings };
