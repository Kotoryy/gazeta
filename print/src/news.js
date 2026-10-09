const { XMLParser } = require("fast-xml-parser");
const { fetchText } = require("./http");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
  parseTagValue: false,
});

const ENTITIES = {
  nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", quot: '"',
  amp: "&", lt: "<", gt: ">", apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  bdquo: "„", copy: "©", deg: "°", times: "×", shy: "",
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}

function text(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text(v["#text"] ?? "");
  return String(v);
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Boilerplate that blog engines append to feed descriptions.
function cleanSummary(s) {
  return s
    .replace(/\s*The post .{3,300}? appeared first on .*$/i, "")
    .replace(/\s*Запись .{3,300}? впервые появилась .*$/i, "")
    .replace(/\s*(Читать|Подробнее|Читать далее|Continue reading|Read more)\W*$/i, "")
    .replace(/[.…]*\s*\[(…|\.\.\.)\]\s*$/, "…")
    .replace(/\.{3,}|…{2,}|\.+…/g, "…")
    .trim();
}

function excerpt(s, max = 320) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.55 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

function asArray(v) {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function findImage(node, html) {
  for (const enc of asArray(node.enclosure)) {
    const url = enc?.["@_url"];
    if (url && (/^image\//.test(enc["@_type"] || "") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) return url;
  }
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const m of asArray(node[key])) {
      const url = m?.["@_url"];
      if (url && (!m["@_medium"] || m["@_medium"] === "image") && !/\.(mp4|mp3|m3u8)(\?|$)/i.test(url)) return url;
    }
  }
  for (const g of asArray(node["media:group"])) {
    const found = findImage(g, "");
    if (found) return found;
  }
  const m = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : "";
}

function linkOf(node) {
  if (typeof node.link === "string") return node.link.trim();
  const links = asArray(node.link);
  const alt = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate"));
  if (alt && alt["@_href"]) return alt["@_href"];
  const t = text(node.link) || text(node.guid);
  return /^https?:/.test(t) ? t : "";
}

function parseFeed(xml) {
  const doc = parser.parse(xml);
  const nodes =
    doc.rss?.channel?.item ??
    doc.feed?.entry ??
    doc["rdf:RDF"]?.item ??
    doc.rss?.item ??
    [];
  return asArray(nodes).map((n) => {
    const html = text(n["content:encoded"]) || text(n.description) || text(n.content) || text(n.summary) || text(n["yandex:full-text"]);
    const date = text(n.pubDate) || text(n.published) || text(n.updated) || text(n["dc:date"]);
    const t = Date.parse(date);
    return {
      title: decodeEntities(stripHtml(text(n.title))),
      link: linkOf(n),
      date: Number.isFinite(t) ? t : 0,
      summary: excerpt(cleanSummary(stripHtml(html))),
      image: findImage(n, html),
    };
  }).filter((i) => i.title && i.link);
}

const feedCache = new Map(); // one download per URL per refresh

async function loadFeed(url) {
  if (!feedCache.has(url)) {
    feedCache.set(url, fetchText(url, { timeout: 20000 }).then(parseFeed));
  }
  return feedCache.get(url);
}

// Identity of a story across issues and feeds.
function itemKey(link) {
  return String(link || "").replace(/[?#].*$/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

// exclude(item) drops stories before the rubric is filled (muted, already read).
async function buildSection(section, exclude) {
  const maxAge = (section.maxAgeDays || 3) * 86400000;
  const now = Date.now();
  let re = null;
  if (section.filter && section.filter.trim()) {
    try { re = new RegExp(section.filter, "i"); } catch { re = null; }
  }
  const errors = [];
  const perFeed = await Promise.all(
    section.feeds.map(async (f) => {
      try {
        const items = await loadFeed(f.url);
        const filterThis = re && (!section.filterOnly || section.filterOnly.includes(f.name));
        return items
          .filter((i) => !i.date || now - i.date < maxAge)
          .filter((i) => !filterThis || re.test(i.title + " " + i.summary))
          .map((i) => ({ ...i, source: f.name, key: itemKey(i.link) }))
          .filter((i) => !exclude || !exclude(i, section));
      } catch (e) {
        errors.push(`${f.name}: ${e.message}`);
        return [];
      }
    })
  );

  // Interleave sources so one prolific feed does not fill the whole rubric.
  const limit = section.limit || 8;
  const cap = Math.max(2, Math.ceil(limit / Math.max(1, perFeed.filter((l) => l.length).length)) + 1);
  const pool = perFeed.flatMap((list) =>
    list.sort((a, b) => b.date - a.date).slice(0, cap)
  );
  // Russian-language stories get a head start of a day and a half over foreign ones.
  const rank = (i) => i.date + (/[а-яё]/i.test(i.title) ? 36 * 3600000 : 0);
  pool.sort((a, b) => rank(b) - rank(a));
  return { id: section.id, title: section.title, limit, pool, errors, feeds: section.feeds.length };
}

async function loadNews(sections, { exclude } = {}) {
  feedCache.clear();
  const built = await Promise.all(sections.map((s) => buildSection(s, exclude)));
  // The same story can come from feeds of several rubrics: earlier rubrics win.
  const seen = new Set();
  return built.map(({ pool, limit, ...sec }) => {
    const items = [];
    for (const it of pool) {
      if (items.length >= limit) break;
      if (seen.has(it.key)) continue;
      seen.add(it.key);
      items.push(it);
    }
    return { ...sec, items };
  });
}

module.exports = { loadNews, parseFeed, itemKey };
