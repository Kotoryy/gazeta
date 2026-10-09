// Official Bank of Russia exchange rates for the front page.
const { fetchJson, fetchText } = require("./http");

const CODES = [
  { code: "USD", name: "Доллар США", sign: "$" },
  { code: "EUR", name: "Евро", sign: "€" },
  { code: "CNY", name: "Юань", sign: "¥" },
];

// cbr-xml-daily.ru mirrors the Bank's daily rates and is reachable from
// abroad; cbr.ru itself is the fallback.
async function fromMirror() {
  const j = await fetchJson("https://www.cbr-xml-daily.ru/daily_json.js", { timeout: 15000 });
  return {
    date: j.Date.slice(0, 10),
    rates: CODES.map((c) => {
      const v = j.Valute[c.code];
      return { ...c, value: v.Value / v.Nominal, previous: v.Previous / v.Nominal };
    }),
  };
}

async function fromBank() {
  const xml = await fetchText("https://www.cbr.ru/scripts/XML_daily.asp", { timeout: 15000 });
  const date = (xml.match(/Date="(\d\d)\.(\d\d)\.(\d{4})"/) || []).slice(1);
  const rates = CODES.map((c) => {
    const m = xml.match(new RegExp(`<CharCode>${c.code}</CharCode>\\s*<Nominal>(\\d+)</Nominal>[\\s\\S]*?<Value>([\\d,]+)</Value>`));
    if (!m) throw new Error("нет курса " + c.code);
    return { ...c, value: parseFloat(m[2].replace(",", ".")) / +m[1], previous: null };
  });
  return { date: date.length ? `${date[2]}-${date[1]}-${date[0]}` : "", rates };
}

async function loadRates() {
  try {
    return await fromMirror();
  } catch {
    return fromBank();
  }
}

module.exports = { loadRates };
