// Public Telegram channels read like RSS feeds: the web view t.me/s/<channel>
// shows the latest ~20 posts as plain HTML.

const ENT = { quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s) => s
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B50}\u{2B06}\u{2194}-\u{21FF}]/gu;

// «https://t.me/name», «t.me/s/name», «@name», «tg:name» → «name»
function channelOf(url) {
  const m = String(url).trim().match(/^(?:tg:|@|https?:\/\/t\.me\/(?:s\/)?)([A-Za-z0-9_]{4,})\/?$/);
  return m ? m[1] : null;
}

function excerpt(s, max = 320) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.55 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

function parseChannel(html) {
  const items = [];
  const re = /data-post="([^"]+)"[\s\S]*?(?=data-post="|$)/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[0];
    if (/service_message/.test(block)) continue;
    const textM = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!textM) continue;
    const text = decode(textM[1]).replace(EMOJI, "").replace(/[ \t]+/g, " ").trim();
    if (/#реклама|erid:|на правах рекламы/i.test(text)) continue;
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^(#\S+\s*)+$/.test(l));
    if (!lines.length) continue;
    // A long first line is a whole paragraph: cut a headline from its first sentence.
    let title = lines[0].replace(/^[\s\-–—•*:|]+/, "");
    let rest = lines.slice(1).join(" ");
    if (title.length > 140) {
      const end = title.search(/[.!?…](\s|$)/);
      const cut = end > 30 && end < 140 ? end + 1 : 120;
      rest = title.slice(cut).trim() + " " + rest;
      title = title.slice(0, cut).trim() + (cut === 120 ? "…" : "");
    }
    const photo = (block.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/) || [])[1] || "";
    items.push({
      title,
      link: `https://t.me/${m[1]}`,
      date: Date.parse((block.match(/datetime="([^"]+)"/) || [])[1]) || 0,
      summary: excerpt(rest.trim()),
      image: photo,
    });
  }
  return items.reverse(); // the page lists posts oldest first
}

module.exports = { parseChannel, channelOf };
