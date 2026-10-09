// Builds the web edition: one self-contained HTML file with the fonts, styles,
// the page-turning paper and the issue data inside, ready to send or publish.
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "app");
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");

function inlineFonts(css) {
  return css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(APP, f)).toString("base64")})`);
}

// JSON inside <script> must not be able to close the tag.
const BS = String.fromCharCode(92);
const safeJson = (data) =>
  JSON.stringify(data)
    .split("<").join(BS + "u003c")
    .split(String.fromCharCode(0x2028)).join(BS + "u2028")
    .split(String.fromCharCode(0x2029)).join(BS + "u2029");

// Options: `hosted` builds the variant for a claude.ai page, which supplies its
// own document skeleton and does not load pictures from other sites; `site` is
// the page for the website, published next to its icon.
function buildWebEdition(issue, { hosted = false, site = false } = {}) {
  // Only what the paper shows: per-source errors are of no use to readers.
  // The reader's own marks (read, saved) stay out of the shared edition.
  const noImage = ({ read, ...it }) => (hosted ? { ...it, image: "" } : it);
  const { saved, offline, ...shared } = issue;
  const slim = {
    ...shared,
    sections: (issue.sections || []).map(({ errors, ...s }) => ({ ...s, items: s.items.slice(0, s.limit || 8).map(noImage) })),
    market: issue.market && { ...issue.market, items: (issue.market.items || []).map(noImage) },
  };
  const day = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" }).format(issue.printedAt);
  const style = `<style>
${inlineFonts(read("styles.css"))}
.toolbar .printed { font-style: italic; letter-spacing: .02em; }
.toolbar { padding-top: env(safe-area-inset-top, 0px); }
</style>`;
  const body = `<nav class="toolbar">
    <span class="brand">Газета</span>
    <button class="tb-btn tb-arrow" id="prevBtn" title="Предыдущий разворот (←)" aria-label="Назад">‹</button>
    <span id="indicatorSlot"></span>
    <button class="tb-btn tb-arrow" id="nextBtn" title="Следующий разворот (→)" aria-label="Вперёд">›</button>
    <select class="tb-select" id="contents" aria-label="В номере"></select>
    <span class="grow"></span>
    <span class="printed hide-narrow" id="printed"></span>
  </nav>
  <main id="paper"></main>
  <script type="application/json" id="issue-data">${safeJson(slim)}</script>
  <script>
${read("paper.js")}
  </script>
  <script>
${read("web.js")}
  </script>`;
  if (hosted) return `<title>Газета</title>
${style}
${body}
`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Газета — ${day}</title>
<meta name="description" content="Газета: новости, погода в Москве, вакансии и барахолка за ${day}.">
<meta property="og:title" content="Газета — ${day}">
<meta property="og:description" content="Новости, погода в Москве, вакансии и барахолка ретро-консолей.">
${site ? `<link rel="icon" type="image/png" href="icon.png">` : ""}
${style}
</head>
<body>
  ${body}
</body>
</html>
`;
}

module.exports = { buildWebEdition };
