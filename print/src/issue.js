// Prints one issue from the settings. Shared by the desktop app and the
// scheduled printing on GitHub (generator/build.js).
const { loadNews } = require("./news");
const { loadWeather } = require("./weather");
const { loadRates } = require("./rates");
const { loadJobs } = require("./jobs");

// When most feeds fail at once the network is down (or the computer has just
// woken up): such an issue must not replace a good one.
const NETWORK_DOWN_SHARE = 0.6;

function mutedTest(muted = {}) {
  const sources = new Set((muted.sources || []).map((s) => s.toLowerCase()));
  const words = (muted.words || []).map((w) => w.toLowerCase()).filter(Boolean);
  return (it) => {
    if (sources.has(String(it.source || "").toLowerCase())) return true;
    const text = (it.title + " " + (it.summary || "")).toLowerCase();
    return words.some((w) => text.includes(w));
  };
}

// opts.depth: print that many times more stories than a rubric shows, so the
// reader's copy still has enough after the stories already read are taken out.
// opts.market: async loader for the flea market, or null to carry it over.
async function buildIssue(cfg, { prev = null, depth = 1, market = null, jobs = cfg.jobs } = {}) {
  const deep = cfg.sections.map((s) => ({ ...s, limit: (s.limit || 8) * depth }));
  const muted = mutedTest(cfg.muted);
  const settle = (p) => p.then((value) => ({ value }), (e) => ({ error: e.message || String(e) }));
  const [news, weather, jobsRes, marketRes, rates] = await Promise.all([
    settle(loadNews(deep, { exclude: muted })),
    settle(loadWeather(cfg.weather)),
    settle(loadJobs(jobs)),
    market ? settle(market(cfg.market)) : Promise.resolve({ value: null }),
    settle(loadRates()),
  ]);

  const sections = (news.value || []).map((s) => ({ ...s, limit: cfg.sections.find((c) => c.id === s.id)?.limit || 8 }));
  const feeds = sections.reduce((n, s) => n + s.feeds, 0);
  const failed = sections.reduce((n, s) => n + s.errors.length, 0);
  const networkDown = !news.value || (feeds > 0 && failed / feeds > NETWORK_DOWN_SHARE);

  const issue = {
    printedAt: Date.now(),
    city: cfg.weather.city,
    sections,
    newsError: news.error || null,
    weather: weather.value || null,
    weatherError: weather.error || null,
    rates: rates.value || null,
    jobs: jobsRes.value || null,
    jobsError: jobsRes.error || null,
    market: marketRes.value || null,
    marketError: marketRes.error || null,
    marketTitle: cfg.market.title,
    keywords: cfg.jobs.keywords,
  };

  // Whatever could not be fetched this time is taken from the previous issue.
  if (prev) {
    for (const sec of issue.sections) {
      const old = prev.sections?.find((s) => s.id === sec.id);
      if (!sec.items.length && sec.errors.length >= sec.feeds && old?.items.length) {
        sec.items = old.items.filter((i) => !muted(i));
        sec.stale = old.stale || prev.printedAt;
      }
    }
    if (!issue.rates && prev.rates) issue.rates = prev.rates;
    if (!issue.weather && prev.weather) { issue.weather = prev.weather; issue.weatherStale = prev.weatherStale || prev.printedAt; }
    const jobsFailed = !issue.jobs || (!issue.jobs.items.length && issue.jobs.notes.length > 0);
    if (jobsFailed && prev.jobs?.items?.length) issue.jobs = { ...prev.jobs, stale: prev.jobs.stale || prev.printedAt };
    if (!issue.market?.items?.length && prev.market?.items?.length) {
      issue.market = { ...prev.market, stale: prev.market.stale || prev.printedAt };
    }
  }
  return { issue, networkDown };
}

module.exports = { buildIssue, mutedTest };
