const { fetchJson } = require("./http");
const { scrapePage } = require("./scrape");

const MSK = 3 * 3600000;

// Yesterday's date in Moscow and its bounds as timestamps.
function yesterday() {
  const day = new Date(Date.now() + MSK - 86400000).toISOString().slice(0, 10);
  const from = Date.parse(`${day}T00:00:00+03:00`);
  return { day, from, to: from + 86400000 };
}

function stemOf(word) {
  const w = word.trim().toLowerCase();
  return w.length > 6 ? w.slice(0, -2) : w;
}

function titleMatches(title, keywords) {
  const t = title.toLowerCase();
  return keywords.some((k) => t.includes(stemOf(k)));
}

const REMOTE_RE = /удал[её]нн|дистанц|remote|из дома/i;

function fmtMoney(n) {
  return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
}

function salaryText(min, max, cur = "₽") {
  if (min && max && min !== max) return `${fmtMoney(min)}–${fmtMoney(max)} ${cur}`;
  if (min) return `от ${fmtMoney(min)} ${cur}`;
  if (max) return `до ${fmtMoney(max)} ${cur}`;
  return "";
}

/* ---------- «Работа России» (trudvsem.ru), open API ---------- */

const MOSCOW_REGIONS = ["7700000000000", "5000000000000"];

async function loadTrudvsem(cfg, y) {
  const iso = (t) => new Date(t).toISOString().replace(/\.\d+Z$/, "Z");
  const out = [];
  for (const kw of cfg.keywords) {
    for (let page = 0; page < 5; page++) {
      const url =
        "https://opendata.trudvsem.ru/api/v1/vacancies" +
        `?text=${encodeURIComponent(kw)}&modifiedFrom=${iso(y.from)}&modifiedTo=${iso(y.to)}` +
        `&limit=100&offset=${page}`;
      const j = await fetchJson(url, { timeout: 25000 });
      const list = (j.results?.vacancies || []).map((v) => v.vacancy);
      out.push(...list);
      if (list.length < 100) break;
    }
  }
  return out
    .filter((v) => titleMatches(v["job-name"] || "", cfg.keywords))
    .map((v) => {
      const blob = [v.schedule, v.employment, v.duty, v.requirement?.qualification, v.conditions].join(" ");
      const remote = REMOTE_RE.test(blob);
      const moscow = MOSCOW_REGIONS.includes(v.region?.region_code);
      const addr = (v.addresses?.address?.[0]?.location || "")
        .replace(/дом:\s*/g, "д. ").replace(/корпус:\s*/g, "корп. ").replace(/строение:\s*/g, "стр. ")
        .replace(/\s*;\s*/g, ", ").replace(/,\s*$/, "").replace(/^г Москва,\s*/, "Москва, ");
      return {
        title: (v["job-name"] || "").replace(/^\S/, (c) => c.toUpperCase()),
        company: (v.company?.name || "").replace(/\s+/g, " "),
        place: remote ? "Удалённо" : moscow ? (addr || v.region.name) : v.region?.name || "",
        salary: salaryText(v.salary_min, v.salary_max),
        salaryMin: v.salary_min || 0,
        salaryMax: v.salary_max || 0,
        url: v.vac_url,
        source: "Работа России",
        isNew: v["creation-date"] === y.day,
        remote,
        moscow,
        schedule: v.schedule || "",
      };
    })
    .filter((v) => (cfg.moscow && v.moscow) || (cfg.remote && v.remote));
}

/* ---------- hh.ru ---------- */

function hhText(keywords) {
  return keywords.map((k) => k.trim()).filter(Boolean).join(" OR ");
}

function hhSearchUrl(cfg, remote) {
  const p = new URLSearchParams({
    text: hhText(cfg.keywords),
    search_field: "name",
    search_period: "1",
    order_by: "publication_time",
    items_on_page: "100",
  });
  if (remote) p.set("work_format", "REMOTE");
  else p.set("area", "1");
  return "https://hh.ru/search/vacancy?" + p;
}

function mapHhApi(v, y) {
  const s = v.salary_range || v.salary || {};
  const cur = !s.currency || s.currency === "RUR" ? "₽" : s.currency;
  const remote =
    (v.work_format || []).some((f) => f.id === "REMOTE") || v.schedule?.id === "remote";
  return {
    title: v.name,
    company: v.employer?.name || "",
    place: remote ? "Удалённо" : v.address?.raw || v.area?.name || "",
    salary: salaryText(s.from, s.to, cur),
    salaryMin: s.from || 0,
    salaryMax: s.to || 0,
    url: v.alternate_url,
    source: "hh.ru",
    isNew: true,
    remote,
    moscow: v.area?.id === "1",
    date: Date.parse(v.published_at),
  };
}

async function loadHhApi(cfg, y) {
  const fmt = (t) => new Date(t + MSK).toISOString().slice(0, 19) + "+0300";
  const base =
    "https://api.hh.ru/vacancies?per_page=100&order_by=publication_time" +
    `&text=${encodeURIComponent(`NAME:(${hhText(cfg.keywords)})`)}` +
    `&date_from=${encodeURIComponent(fmt(y.from))}&date_to=${encodeURIComponent(fmt(y.to))}`;
  const headers = { "HH-User-Agent": "Gazeta/1.0 (desktop newspaper app)" };
  const queries = [];
  if (cfg.moscow) queries.push(base + "&area=1");
  if (cfg.remote) queries.push(base + "&work_format=REMOTE");
  const out = [];
  for (const q of queries) {
    const j = await fetchJson(q, { timeout: 20000, headers });
    out.push(...(j.items || []).map((v) => mapHhApi(v, y)));
  }
  return out;
}

// Fallback: open the regular hh.ru search page in a hidden window and read the
// result cards from the DOM. The site search is limited to «за последние сутки».
const EXTRACT = `(() => {
  if (/captcha/i.test(location.href)) return { blocked: 'hh.ru попросил капчу' };
  if (/vpnche/i.test(location.href)) return { blocked: 'сайт просит отключить VPN' };
  const q = (root, sels) => { for (const s of sels) { const e = root.querySelector(s); if (e) return e.innerText.replace(/\\s+/g, ' ').trim(); } return ''; };
  const anchors = Array.from(document.querySelectorAll('a[data-qa="serp-item__title"], [data-qa="serp-item__title"] a, a[data-qa="serp-item__title-text"]'));
  const seen = new Set();
  const items = [];
  for (const a of anchors) {
    const href = (a.href || '').split('?')[0];
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const card = a.closest('[data-qa^="vacancy-serp__vacancy"]') || a.closest('[class*="vacancy-card"]') || a.parentElement.parentElement.parentElement;
    let salary = q(card, ['[data-qa="vacancy-serp__vacancy-compensation"]', '[class*="compensation"]']);
    if (!salary) { const m = card.innerText.match(/(от|до)?\\s?[\\d\\s\\u202f\\u00a0]{4,}[–-]?[\\d\\s\\u202f\\u00a0]*\\s?₽[^\\n]*/); salary = m ? m[0].trim() : ''; }
    items.push({
      title: a.innerText.replace(/\\s+/g, ' ').trim(),
      url: href,
      company: q(card, ['[data-qa="vacancy-serp__vacancy-employer-text"]', '[data-qa="vacancy-serp__vacancy-employer"]']),
      place: q(card, ['[data-qa="vacancy-serp__vacancy-address"]', '[data-qa="vacancy-serp__vacancy-address_narrow"]']),
      salary: salary.replace(/[\\u202f\\u00a0]/g, ' '),
      remote: /удал[её]нн|можно удал/i.test(card.innerText),
    });
  }
  const empty = !!document.querySelector('[data-qa="vacancies-search-header"], [data-qa="bloko-header-3"]');
  return { items, ready: anchors.length > 0 || empty || document.readyState === 'complete' };
})()`;

function scrapeHh(url) {
  return scrapePage(url, EXTRACT, { partition: "persist:hh" });
}

async function loadHhSite(cfg) {
  const out = [];
  const runs = [];
  if (cfg.moscow) runs.push(false);
  if (cfg.remote) runs.push(true);
  for (const remote of runs) {
    const items = await scrapeHh(hhSearchUrl(cfg, remote));
    out.push(
      ...items.map((v) => {
        const nums = (v.salary.match(/\d[\d ]*/g) || []).map((n) => +n.replace(/ /g, "")).filter((n) => n > 1000);
        const isRemote = remote || v.remote;
        return {
          ...v,
          place: isRemote ? "Удалённо" : v.place,
          salaryMin: /^до/i.test(v.salary) ? 0 : nums[0] || 0,
          salaryMax: nums[1] || (/^до/i.test(v.salary) ? nums[0] : 0) || 0,
          source: "hh.ru",
          isNew: true,
          remote: isRemote,
          moscow: !remote,
        };
      })
    );
  }
  return out.filter((v) => titleMatches(v.title, cfg.keywords));
}

async function loadHh(cfg, y) {
  try {
    return { items: await loadHhApi(cfg, y), period: "yesterday" };
  } catch (apiErr) {
    try {
      return { items: await loadHhSite(cfg), period: "day" };
    } catch (siteErr) {
      throw new Error(`API: ${apiErr.message}; сайт: ${siteErr.message}`);
    }
  }
}

/* ---------- all together ---------- */

async function loadJobs(cfg) {
  const y = yesterday();
  const notes = [];
  const tasks = [];
  let hhPeriod = null;
  if (cfg.sources?.hh !== false) {
    tasks.push(
      loadHh(cfg, y).then(
        (r) => { hhPeriod = r.period; return r.items; },
        (e) => { notes.push(`hh.ru недоступен (${e.message})`); return []; }
      )
    );
  }
  if (cfg.sources?.trudvsem !== false) {
    tasks.push(
      loadTrudvsem(cfg, y).catch((e) => { notes.push(`«Работа России» недоступна (${e.message})`); return []; })
    );
  }
  const all = (await Promise.all(tasks)).flat();

  const seen = new Set();
  const items = all
    .filter((v) => !cfg.minSalary || !(v.salaryMax || v.salaryMin) || Math.max(v.salaryMin, v.salaryMax) >= cfg.minSalary)
    .filter((v) => {
      const key = (v.title + "|" + v.company).toLowerCase().replace(/[^a-zа-яё0-9|]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.source === "hh.ru") - (a.source === "hh.ru") || b.isNew - a.isNew || (b.salaryMin || 0) - (a.salaryMin || 0));

  return {
    day: y.day,
    items,
    notes,
    hhPeriod,
    hhLinks: [cfg.moscow && hhSearchUrl(cfg, false), cfg.remote && hhSearchUrl(cfg, true)].filter(Boolean),
  };
}

module.exports = { loadJobs };
