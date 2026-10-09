"use strict";
// The newspaper itself: builds the issue from data, lays it out on fixed-size
// pages and turns them like a real paper. Shared by the desktop app and the
// web edition; it only needs the `issue` object.

(function () {
  const TZ = "Europe/Moscow";
  const RATIO = 0.72; // page width / height
  const FLIP_MS = 900;

  /* ---------- helpers ---------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const fmt = (opts) => new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, ...opts });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit" });
  const fDayMonth = fmt({ day: "numeric", month: "long" });
  const fShortDay = fmt({ day: "numeric", month: "short" });
  const fWeekdayShort = fmt({ weekday: "short" });
  const fFull = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const mskDay = (t) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);

  function when(t) {
    if (!t) return "";
    if (mskDay(t) === mskDay(Date.now())) return fTime.format(t);
    if (mskDay(t) === mskDay(Date.now() - 86400000)) return "вчера, " + fTime.format(t);
    return fShortDay.format(t).replace(".", "") + ", " + fTime.format(t);
  }
  const deg = (n) => { const r = Math.round(n); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r) + "°"; };
  const windDir = (d) => ["северный", "северо-восточный", "восточный", "юго-восточный", "южный", "юго-западный", "западный", "северо-западный"][Math.round(d / 45) % 8];
  const isForeign = (s) => !/[а-яё]/i.test(s);
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function issueNumber(t) {
    const d = new Date(mskDay(t));
    return Math.floor((d - new Date(d.getUTCFullYear() + "-01-01")) / 86400000) + 1;
  }
  const dateLine = (t) => fFull.format(t).replace(/\s*г\.$/, "").replace(/^./, (c) => c.toUpperCase()) + " года";

  /* ---------- pieces of the issue ---------- */

  let issue = null;
  let opts = {};             // { actions, onRead, onSave, onMute } — set by the shell
  const byKey = new Map();   // story key → story, for the action buttons
  const keyOf = (it) => it.key || String(it.link || "").replace(/[?#].*$/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const isSaved = (key) => (issue.saved || []).some((s) => s.key === key);

  // «Отложить» and «Меньше такого» under a story, in the desktop app only.
  function acts(it) {
    if (!opts.actions) return "";
    const key = keyOf(it);
    byKey.set(key, it);
    const saved = isSaved(key);
    return `<span class="acts">
      <span class="act${saved ? " on" : ""}" role="button" tabindex="0" data-act="save" data-key="${esc(key)}" title="${saved ? "Убрать из отложенного" : "Сохранить, чтобы прочитать позже"}">${saved ? "★ Отложено" : "☆ Отложить"}</span>
      <span class="act" role="button" tabindex="0" data-act="mute" data-key="${esc(key)}" title="Не показывать похожее">Меньше такого</span>
    </span>`;
  }

  const meta = (it) =>
    `<div class="meta">${esc(it.source)}${it.date ? " · " + esc(when(it.date)) : ""}${isForeign(it.title) ? '<span class="lang">EN</span>' : ""}${acts(it)}</div>`;

  const picture = (src) =>
    src ? `<figure class="pic"><img src="${esc(safeUrl(src))}" alt="" referrerpolicy="no-referrer" decoding="async"></figure>` : "";

  const itemHtml = (it) => `<a class="item${it.read ? " read" : ""}" href="${esc(safeUrl(it.link))}" target="_blank" rel="noopener" data-key="${esc(keyOf(it))}">
      <h4 class="hl">${esc(it.title)}</h4>
      ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
      ${meta(it)}
    </a>`;

  function mastheadHtml(sections) {
    const t = issue.printedAt;
    const notes = (issue.sections || []).reduce((n, s) => n + s.items.length, 0);
    const jobs = issue.jobs?.items.length || 0;
    const lots = issue.market?.items?.length || 0;
    const ear = `<div class="ear-label">Цена свободная</div>
      <div class="ear-text">${notes} ${plural(notes, "заметка", "заметки", "заметок")},
        ${jobs} ${plural(jobs, "вакансия", "вакансии", "вакансий")},
        ${lots} ${plural(lots, "лот", "лота", "лотов")} на барахолке</div>`;
    const toc = sections.map((s) => `<li><a href="#" data-go="${esc(s.id)}">${esc(s.title)}</a><span data-toc="${esc(s.id)}"></span></li>`).join("");
    return `<div class="mast">
      <div class="mast-top">
        <span>Выпуск № ${issueNumber(t)} · Год издания первый</span>
        <span>Отпечатано ${mskDay(t) === mskDay(Date.now()) ? "сегодня" : esc(fShortDay.format(t))} в ${fTime.format(t)}</span>
      </div>
      <div class="mast-row">
        <div class="ear">${ear}</div>
        <h1 class="title">Газета</h1>
        <div class="ear ear-toc"><div class="ear-label">В номере</div><ol>${toc}</ol></div>
      </div>
      <div class="dateline">
        <span>${esc(dateLine(t))}</span>
        <span class="motto">Ежедневное издание для одного читателя</span>
        <span>Москва</span>
      </div>
    </div>`;
  }

  function weatherHtml(w) {
    if (!w) return `<div class="block-title">Погода</div><div class="empty">Метеосводка не поступила.</div>`;
    const parts = w.parts.map((p) => `<th>${esc(p.label)}</th>`).join("");
    const glyphs = w.parts.map((p) => `<td class="g" title="${esc(p.text)}">${p.glyph}</td>`).join("");
    const temps = w.parts.map((p) => `<td class="t">${deg(p.temp)}</td>`).join("");
    const rain = w.parts.map((p) => `<td>${p.rain ?? 0}%</td>`).join("");
    const days = w.days.slice(1).map((d) => {
      const t = Date.parse(d.date + "T12:00:00+03:00");
      return `<tr><td>${esc(fWeekdayShort.format(t))}, ${esc(fShortDay.format(t).replace(".", ""))}</td>
        <td class="g" title="${esc(d.text)}">${d.glyph}</td><td class="t">${deg(d.max)}</td><td>${deg(d.min)}</td><td>${d.rain ?? 0}%</td></tr>`;
    }).join("");
    const today = w.days[0];
    return `<div class="wx-col"><div class="block-title">Погода в Москве</div>
      <div class="wx-now"><span class="big">${deg(w.temp)}</span><span class="glyph">${w.glyph}</span><span class="desc">${esc(w.text)}</span></div>
      <div class="wx-facts">Ощущается как ${deg(w.feels)}. Ветер ${esc(windDir(w.windDir))}, ${Math.round(w.wind)} м/с. Влажность ${w.humidity}%, давление ${w.pressure} мм рт. ст.</div></div>
      <div class="wx-col"><div class="block-title">Сегодня</div><table class="wx-table"><thead><tr>${parts}</tr></thead><tbody><tr>${glyphs}</tr><tr>${temps}</tr><tr>${rain}</tr></tbody></table></div>
      <div class="wx-col"><table class="wx-table wx-days"><thead><tr><th>Дни</th><th></th><th>день</th><th>ночь</th><th title="Вероятность осадков">☂</th></tr></thead><tbody>${days}</tbody></table>
      ${today ? `<div class="wx-sun">Восход ${esc(today.sunrise)}, заход ${esc(today.sunset)}.</div>` : ""}</div>`;
  }

  function pickFeature(items) {
    let i = items.findIndex((x) => x.image && x.summary);
    if (i < 0) i = items.findIndex((x) => x.summary);
    return Math.max(0, i);
  }

  // A block is one unbreakable piece of the paper. `span` blocks stretch over
  // all columns; `brk` starts a new page; `sec` lets a continuation get a heading.
  const fRate = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function ratesHtml(r) {
    if (!r?.rates?.length) return "";
    const day = r.date ? fDayMonth.format(Date.parse(r.date + "T12:00:00+03:00")) : "";
    const cells = r.rates.map((x) => {
      const d = x.previous ? x.value - x.previous : 0;
      const trend = Math.abs(d) < 0.005 ? "" :
        `<span class="trend" title="${d > 0 ? "Выше" : "Ниже"}, чем днём раньше">${d > 0 ? "▲" : "▼"} ${fRate.format(Math.abs(d))}</span>`;
      return `<div class="rate"><span class="cur" title="${esc(x.name)}">${esc(x.sign)}</span>
        <span class="val">${fRate.format(x.value)}</span>${trend}<span class="cur-name">${esc(x.name)}</span></div>`;
    }).join("");
    return `<div class="rates"><div class="block-title">Курсы ЦБ${day ? " на " + esc(day) : ""}</div><div class="rate-row">${cells}</div></div>`;
  }

  function buildBlocks() {
    byKey.clear();
    const out = [];
    let n = 0;
    const add = (b) => out.push({ bid: "b" + n++, ...b });
    const sections = issue.sections || [];
    const [main, ...rubrics] = sections;

    const tocSections = rubrics.filter((s) => s.items.length).map((s) => ({ id: s.id, title: s.title }));
    tocSections.push({ id: "ads", title: "Объявления" });
    add({ span: true, kind: "mast", html: mastheadHtml(tocSections) });

    add({ span: true, kind: "wx", html: `<div class="wx">${weatherHtml(issue.weather)}</div>` });
    if (issue.rates) add({ span: true, kind: "rates", html: ratesHtml(issue.rates) });
    const mainItems = main?.items || [];
    if (mainItems.length) {
      const li = pickFeature(mainItems);
      const lead = mainItems[li];
      add({
        span: true, kind: "lead", sec: main.id, html: `<a class="lead" href="${esc(safeUrl(lead.link))}" target="_blank" rel="noopener" data-key="${esc(keyOf(lead))}">
          <div class="kicker">${esc(main.title)}</div>
          <h2 class="hl">${esc(lead.title)}</h2>
          <div class="lead-body${lead.image ? "" : " no-img"}">${picture(lead.image)}
            <div>${lead.summary ? `<p class="summary">${esc(lead.summary)}</p>` : ""}${meta(lead)}</div>
          </div></a>`,
      });
      mainItems.forEach((it, i) => i !== li && add({ kind: "item", sec: main.id, secTitle: main.title, html: itemHtml(it) }));
    }

    for (const sec of rubrics) {
      const count = sec.items.length;
      const countText = sec.stale ? `из выпуска от ${esc(when(sec.stale))}: ленты не ответили`
        : count ? count + " " + plural(count, "заметка", "заметки", "заметок") : "";
      const head = `<div class="rubric-head"><h3>${esc(sec.title)}</h3><span class="count">${countText}</span></div>`;
      if (!count) {
        const why = opts.actions ? "Новых заметок нет — всё, что было, вы уже видели." : "Свежих материалов в рубрике нет.";
        add({ span: true, kind: "head", sec: sec.id, html: `<div class="rubric">${head}<div class="empty">${why}</div></div>` });
        continue;
      }
      const fi = pickFeature(sec.items);
      const f = sec.items[fi];
      add({
        span: true, kind: "head", sec: sec.id, html: `<div class="rubric">${head}
          <a class="feature${f.image ? "" : " no-img"}${f.read ? " read" : ""}" href="${esc(safeUrl(f.link))}" target="_blank" rel="noopener" data-key="${esc(keyOf(f))}">${picture(f.image)}
            <div><h4 class="hl">${esc(f.title)}</h4>${f.summary ? `<p>${esc(f.summary)}</p>` : ""}${meta(f)}</div></a></div>`,
      });
      sec.items.forEach((it, i) => i !== fi && add({ kind: "item", sec: sec.id, secTitle: sec.title, html: itemHtml(it) }));
    }

    // Stories the reader put aside, kept from issue to issue.
    const saved = opts.actions ? issue.saved || [] : [];
    if (saved.length) {
      add({ span: true, kind: "head", sec: "saved", html: `<div class="rubric saved-rubric"><div class="rubric-head"><h3>Отложено</h3>
        <span class="count">${saved.length} ${plural(saved.length, "заметка", "заметки", "заметок")} · снимите звёздочку, когда прочитаете</span></div></div>` });
      saved.forEach((it) => add({ kind: "item", sec: "saved", secTitle: "Отложено", html: itemHtml(it) }));
    }

    // Classifieds: jobs, then the flea market.
    const jobs = issue.jobs;
    const kw = (issue.keywords || []).join(", ");
    const dayT = jobs ? Date.parse(jobs.day + "T12:00:00+03:00") : 0;
    add({
      span: true, brk: true, kind: "ads-head", sec: "ads", html: `<div class="ads-head">
        <div class="ads-kicker">Объявления</div><h3>Требуются</h3>
        <p>${esc(kw)}${jobs ? " · опубликованы " + esc(fDayMonth.format(dayT)) : ""}</p></div>`,
    });
    if (jobs?.items.length) {
      for (const v of jobs.items) {
        add({
          kind: "ad", sec: "ads", secTitle: "Требуются", html: `<a class="ad${v.salary ? " top" : ""}" href="${esc(safeUrl(v.url))}" target="_blank" rel="noopener">
            <div class="ad-title">${esc(v.title)}</div>
            ${v.company ? `<div class="ad-company">${esc(v.company)}</div>` : ""}
            ${v.place ? `<div class="ad-place">${esc(v.place)}</div>` : ""}
            ${v.salary ? `<div class="ad-salary">${esc(v.salary)}</div>` : ""}
            <div class="ad-foot"><span>${esc(v.source)}</span>${v.isNew && v.source !== "hh.ru" ? '<span class="new">новая</span>' : ""}</div></a>`,
        });
      }
    } else {
      add({ kind: "note", sec: "ads", html: `<div class="empty">${jobs ? "Вчера подходящих объявлений не нашлось." : "Объявления о работе не поступили."}</div>` });
    }
    const jobNotes = [];
    if (jobs?.stale) jobNotes.push(`Вакансии из выпуска от ${when(jobs.stale)}: источники сейчас не ответили.`);
    if (jobs?.hhPeriod === "day") jobNotes.push("Объявления hh.ru — за последние сутки.");
    if (jobs?.notes) jobNotes.push(...jobs.notes);
    const hhLinks = (jobs?.hhLinks || []).map((u, i, a) =>
      `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${a.length > 1 ? (i === 0 ? "hh.ru: Москва" : "hh.ru: удалённо") : "hh.ru"}</a>`).join(" · ");
    if (hhLinks || jobNotes.length) {
      add({ kind: "note", sec: "ads", html: `<div class="ad-note">${hhLinks ? `<div>Поиск: ${hhLinks}</div>` : ""}${jobNotes.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` });
    }

    const market = issue.market;
    add({
      span: true, kind: "market-head", sec: "market", html: `<div class="ads-head market-head">
        <h3>Барахолка</h3><p>${esc(issue.marketTitle || "Ретро-консоли")} · продают в Москве</p></div>`,
    });
    if (market?.items?.length) {
      for (const m of market.items) {
        add({
          kind: "ad", sec: "market", secTitle: "Барахолка", html: `<a class="ad lot" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">
            ${m.image ? `<figure class="pic lot-pic"><img src="${esc(safeUrl(m.image))}" alt="" referrerpolicy="no-referrer" decoding="async"></figure>` : ""}
            <div class="ad-title">${esc(m.title)}</div>
            ${m.price ? `<div class="ad-salary">${esc(m.price)}</div>` : ""}
            ${m.place ? `<div class="ad-place">${esc(m.place)}</div>` : ""}
            <div class="ad-foot"><span>${esc(m.source)}</span>${m.date ? `<span>${esc(m.date)}</span>` : ""}</div></a>`,
        });
      }
    } else {
      add({ kind: "note", sec: "market", html: `<div class="empty">Объявления о продаже не поступили.</div>` });
    }
    const mNotes = [...(market?.notes || [])];
    if (market?.stale) mNotes.push(`Объявления из выпуска от ${when(market.stale)}.`);
    const mLinks = (market?.links || []).map((l) => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(" · ");
    add({ kind: "note", sec: "market", html: `<div class="ad-note">${mLinks ? `<div>Искать самому: ${mLinks}</div>` : ""}${mNotes.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` });

    const sources = new Set();
    sections.forEach((s) => s.items.forEach((i) => sources.add(i.source)));
    add({
      span: true, kind: "colophon", html: `<div class="colophon">
        <div class="block-title">Выходные данные</div>
        <p>«Газета» — ежедневное издание для одного читателя. Отпечатано ${esc(dateLine(issue.printedAt).toLowerCase())} в ${fTime.format(issue.printedAt)}.</p>
        <p>Источники: ${esc([...sources].join(", "))}; погода — Open-Meteo; вакансии — hh.ru, «Работа России»; объявления — Юла, Авито.</p>
        <p>Нажмите на заметку, чтобы прочитать её целиком.</p></div>`,
    });
    return out;
  }

  /* ---------- layout on pages ---------- */

  let root = null;       // element the paper lives in
  let book, slotL, slotR, measure, indicator;
  let blocks = [];
  let pages = [];        // detached .page elements
  let sectionPage = {};  // section id → page index
  let W = 0, H = 0, mode = "spread";
  let cur = 0;           // current spread (or page in single mode)
  let busy = false;
  const listeners = new Set();

  const toNode = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  function newPage(index) {
    const p = document.createElement("div");
    p.className = "page " + (index % 2 ? "even" : "odd");
    p.dataset.index = index;
    p.innerHTML = (index === 0 ? "" : `<div class="running"><span>${index + 1}</span><span class="running-title">Газета</span><span>${esc(dateLine(issue.printedAt))}</span></div>`) +
      `<div class="page-body"></div><div class="folio">— ${index + 1} —</div>`;
    return p;
  }

  const overflows = (body) => body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;

  function columnsFor(width) {
    return Math.max(1, Math.min(4, Math.floor((width - 44) / 185)));
  }

  function paginate() {
    measure.style.setProperty("--pw", W + "px");
    measure.style.setProperty("--ph", H + "px");
    measure.style.setProperty("--cols", columnsFor(W));
    measure.replaceChildren();
    pages = [];
    sectionPage = {};
    let page, body;
    const open = () => { page = newPage(pages.length); measure.append(page); body = page.querySelector(".page-body"); };
    const close = () => { page.remove(); pages.push(page); };
    open();
    const node = (b) => {
      const n = toNode(b.html);
      n.classList.add("blk", "k-" + b.kind);
      if (b.span) n.classList.add("span");
      n.dataset.bid = b.bid;
      return n;
    };
    const placed = new Set();
    const mark = (b) => { placed.add(b); if (b.sec && !(b.sec in sectionPage)) sectionPage[b.sec] = pages.length; };
    const SMALL = new Set(["item", "ad", "note"]);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (placed.has(b)) continue;
      if (b.brk && body.children.length) { close(); open(); }
      const n = node(b);
      body.append(n);
      // The lead story stays on the front page, without its picture if need be.
      if (b.kind === "lead" && overflows(body)) {
        n.classList.add("squeeze");
        if (overflows(body)) n.classList.add("squeeze-more");
        if (overflows(body)) n.classList.remove("squeeze", "squeeze-more");
      }
      if (overflows(body)) {
        n.remove();
        if (body.children.length && !(body.children.length === 1 && body.firstElementChild.classList.contains("k-cont"))) {
          // Before turning the page, fill the gap with the next short pieces
          // of the same rubric that still fit.
          if (b.kind !== "head" && b.sec) {
            for (let j = i + 1, tried = 0; j < blocks.length && tried < 10; j++) {
              const c = blocks[j];
              if (c.sec !== b.sec) break;
              if (placed.has(c) || !SMALL.has(c.kind)) continue;
              tried++;
              const cn = node(c);
              body.append(cn);
              if (overflows(body)) cn.remove(); else mark(c);
            }
          }
          close(); open();
          if (b.secTitle && b.kind !== "head") {
            const c = toNode(`<div class="cont-head">${esc(b.secTitle)} <i>— продолжение</i></div>`);
            c.classList.add("blk", "span", "k-cont");
            body.append(c);
          }
        }
        body.append(n);
        // Too big for an empty page: drop the picture and the text, keep the headline.
        if (overflows(body)) n.classList.add("squeeze");
        if (overflows(body)) n.classList.add("squeeze-more");
      }
      mark(b);
    }
    close();
    // Page numbers in the front-page contents.
    pages[0].querySelectorAll("[data-toc]").forEach((el) => {
      const p = sectionPage[el.dataset.toc];
      el.textContent = p != null ? p + 1 : "";
    });
  }

  /* ---------- spreads ---------- */

  const spreadCount = () => (mode === "spread" ? Math.ceil((pages.length - 1) / 2) + 1 : pages.length);
  const pageToSpread = (p) => (mode === "spread" ? (p === 0 ? 0 : Math.floor((p + 1) / 2)) : p);
  function spreadPages(s) {
    if (mode !== "spread") return [null, s];
    if (s === 0) return [null, 0];
    return [2 * s - 1, 2 * s < pages.length ? 2 * s : null];
  }
  function shiftFor(s) {
    if (mode !== "spread") return 0;
    const [l, r] = spreadPages(s);
    if (l == null) return -W / 2;
    if (r == null) return W / 2;
    return 0;
  }

  function put(slot, index) {
    slot.replaceChildren();
    if (index != null && pages[index]) slot.append(pages[index]);
    slot.classList.toggle("blank", index == null);
  }

  function show() {
    const [l, r] = spreadPages(cur);
    put(slotL, l);
    put(slotR, r);
    book.style.transform = `translateX(${shiftFor(cur)}px)`;
    const shown = [l, r].filter((x) => x != null).map((x) => x + 1);
    indicator.textContent = `${shown.length > 1 ? "Стр. " + shown.join("–") : "Стр. " + shown[0]} из ${pages.length}`;
    root.querySelector(".turn.prev").hidden = cur === 0;
    root.querySelector(".turn.next").hidden = cur >= spreadCount() - 1;
    listeners.forEach((fn) => fn({ spread: cur, pages: shown, total: pages.length }));
    trackRead();
  }

  // A story counts as read once its page has been open for a moment.
  let readTimer = null;
  function trackRead() {
    clearTimeout(readTimer);
    if (!opts.onRead) return;
    readTimer = setTimeout(() => {
      const keys = [...slotL.querySelectorAll("[data-key]"), ...slotR.querySelectorAll("[data-key]")].map((a) => a.dataset.key);
      if (keys.length) opts.onRead([...new Set(keys)]);
    }, 1500);
  }

  /* ---------- «Отложить» and «Меньше такого» ---------- */

  const STOP = new Set("после через может будет более между которые который которая против своих также сегодня заявил заявила рассказал рассказала стало стали станет новые новый новая время россии россия года году about after their there which would could first years".split(" "));

  function topicWords(it) {
    const words = (it.title.toLowerCase().match(/[a-zа-яё][a-zа-яё-]{4,}/g) || []).filter((w) => !STOP.has(w));
    return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 4);
  }
  // Russian words change their endings; matching by the stem catches the forms.
  const stem = (w) => (w.length > 6 ? w.slice(0, -2) : w);

  function closePop() { root.querySelector(".mute-pop")?.remove(); }

  function openMute(btn, it) {
    closePop();
    const pop = document.createElement("div");
    pop.className = "mute-pop";
    pop.innerHTML = `<div class="pop-title">Меньше такого</div>
      <button type="button" class="pop-opt" data-kind="source" data-value="${esc(it.source)}">Не показывать заметки «${esc(it.source)}»</button>
      <div class="pop-label">Скрыть заметки со словом:</div>
      <div class="pop-chips">${topicWords(it).map((w) => `<button type="button" class="pop-chip" data-kind="word" data-value="${esc(stem(w))}">${esc(w)}</button>`).join("")}</div>
      <form class="pop-own"><input type="text" placeholder="своё слово" aria-label="Слово, которое нужно скрыть"><button type="submit" class="pop-chip">Скрыть</button></form>
      <button type="button" class="pop-cancel">Отмена</button>`;
    root.append(pop);
    const r = btn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left - rr.left, rr.width - pop.offsetWidth - 8)) + "px";
    const below = r.bottom - rr.top + 6;
    pop.style.top = (below + pop.offsetHeight > rr.height ? r.top - rr.top - pop.offsetHeight - 6 : below) + "px";
    const choose = (kind, value) => {
      closePop();
      if (!value) return;
      opts.onMute?.(kind, value);
      hideWhere(kind === "source"
        ? (i) => i.source === value
        : (i) => (i.title + " " + (i.summary || "")).toLowerCase().includes(value.toLowerCase()));
    };
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-kind]");
      if (b) choose(b.dataset.kind, b.dataset.value);
      else if (e.target.closest(".pop-cancel")) closePop();
    });
    pop.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      choose("word", stem(e.target.querySelector("input").value.trim().toLowerCase()));
    });
    pop.querySelector(".pop-opt").focus();
  }

  // Muting takes effect at once on the paper in hand.
  function hideWhere(test) {
    for (const s of issue.sections || []) s.items = s.items.filter((i) => !test(i));
    render(issue);
  }

  async function toggleSave(it) {
    if (!opts.onSave) return;
    const key = keyOf(it);
    issue.saved = await opts.onSave({ ...it, key }, !isSaved(key));
    render(issue);
  }

  function face(index, side) {
    const f = document.createElement("div");
    f.className = "face " + side;
    if (index != null && pages[index]) f.append(pages[index].cloneNode(true));
    else f.classList.add("blank");
    const shade = document.createElement("div");
    shade.className = "shade";
    f.append(shade);
    return f;
  }

  function flipTo(target, instant) {
    target = Math.max(0, Math.min(spreadCount() - 1, target));
    if (busy || target === cur) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduce) { cur = target; show(); return; }
    busy = true;
    const fwd = target > cur;
    const [cl, cr] = spreadPages(cur);
    const [tl, tr] = spreadPages(target);
    const leaf = document.createElement("div");
    let from, to;
    if (mode === "spread") {
      leaf.className = "leaf " + (fwd ? "on-right" : "on-left");
      leaf.append(face(fwd ? cr : cl, "front"), face(fwd ? tl : tr, "back"));
      if (fwd) put(slotR, tr); else put(slotL, tl);
      from = 0; to = fwd ? -180 : 180;
    } else {
      // A single page turns over its left edge like a notebook sheet.
      leaf.className = "leaf on-right single";
      if (fwd) { leaf.append(face(cr, "front"), face(null, "back")); put(slotR, tr); from = 0; to = -180; }
      else { leaf.append(face(tr, "front"), face(null, "back")); from = -180; to = 0; }
    }
    book.append(leaf);
    const easing = "cubic-bezier(.4,.05,.3,1)";
    book.style.transition = `transform ${FLIP_MS}ms ${easing}`;
    book.style.transform = `translateX(${shiftFor(target)}px)`;
    const anim = leaf.animate(
      [{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${(from + to) / 2}deg) translateZ(30px)`, offset: 0.5 }, { transform: `rotateY(${to}deg)` }],
      { duration: FLIP_MS, easing }
    );
    const [front, back] = leaf.querySelectorAll(".shade");
    front.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: FLIP_MS / 2, easing: "ease-in", fill: "forwards" });
    back.animate([{ opacity: 0.45 }, { opacity: 0.45, offset: 0.5 }, { opacity: 0 }], { duration: FLIP_MS, easing: "ease-out", fill: "forwards" });
    anim.finished.then(() => {
      book.style.transition = "";
      cur = target;
      leaf.remove();
      show();
      busy = false;
    });
  }

  /* ---------- sizing ---------- */

  function measureStage() {
    const stage = root.querySelector(".stage");
    const sw = stage.clientWidth - 24, sh = stage.clientHeight - 20;
    let h = sh, w = Math.floor(h * RATIO), m = "spread";
    if (2 * w > sw) w = Math.floor(sw / 2);
    // Pages narrower than this are unreadable side by side: show one page,
    // letting it grow wider than the paper ratio in a low window.
    if (w < 430) {
      m = "single";
      w = sw < 560 ? sw : Math.min(sw, Math.max(Math.floor(h * RATIO), 560));
    }
    return { w: Math.max(300, w), h: Math.max(420, Math.floor(h)), m };
  }

  function layout(keepPage) {
    const { w, h, m } = measureStage();
    // Remember the first block on screen to come back to it after re-pagination.
    let anchor = null;
    if (keepPage && pages.length) {
      const [l, r] = spreadPages(cur);
      const p = pages[l ?? r];
      anchor = p && p.querySelector(".blk:not(.k-cont)")?.dataset.bid;
    }
    W = w; H = h; mode = m;
    root.style.setProperty("--pw", W + "px");
    root.style.setProperty("--ph", H + "px");
    root.style.setProperty("--cols", columnsFor(W));
    root.classList.toggle("single", mode === "single");
    root.classList.toggle("narrow-page", W < 560);
    root.classList.toggle("compact-page", W < 640);
    book.style.width = (mode === "spread" ? 2 * W : W) + "px";
    book.style.height = H + "px";
    paginate();
    let p = 0;
    if (anchor) p = Math.max(0, pages.findIndex((pg) => pg.querySelector(`[data-bid="${anchor}"]`)));
    cur = Math.min(pageToSpread(p), spreadCount() - 1);
    show();
  }

  /* ---------- input ---------- */

  function bindInput() {
    root.querySelector(".turn.prev").addEventListener("click", () => flipTo(cur - 1));
    root.querySelector(".turn.next").addEventListener("click", () => flipTo(cur + 1));
    document.addEventListener("keydown", (e) => {
      if (e.target.closest?.("input, textarea, select, dialog[open], .mute-pop, .act")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); flipTo(cur + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); flipTo(cur - 1); }
      else if (e.key === "Home") flipTo(0);
      else if (e.key === "End") flipTo(spreadCount() - 1);
    });
    let wheelLock = 0;
    root.querySelector(".stage").addEventListener("wheel", (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 12 || Date.now() < wheelLock) return;
      wheelLock = Date.now() + FLIP_MS + 150;
      flipTo(cur + (d > 0 ? 1 : -1));
    }, { passive: true });
    let sx = null, sy = 0;
    root.querySelector(".stage").addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
    root.querySelector(".stage").addEventListener("pointerup", (e) => {
      if (sx == null || e.pointerType === "mouse") return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) flipTo(cur + (dx < 0 ? 1 : -1));
    });
    // Story actions live inside the story link: keep the link from opening.
    const onAct = (e) => {
      const b = e.target.closest(".act");
      if (!b) return false;
      e.preventDefault();
      e.stopPropagation();
      const it = byKey.get(b.dataset.key);
      if (!it) return true;
      if (b.dataset.act === "save") toggleSave(it); else openMute(b, it);
      return true;
    };
    root.addEventListener("click", (e) => {
      if (onAct(e)) return;
      if (!e.target.closest(".mute-pop")) closePop();
    }, true);
    root.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("act")) onAct(e);
      if (e.key === "Escape") closePop();
    });

    // Contents links on the front page jump to their page.
    root.addEventListener("click", (e) => {
      const a = e.target.closest("[data-go]");
      if (!a) return;
      e.preventDefault();
      goToSection(a.dataset.go);
    });
    // A picture that fails to load is dropped together with its column, also
    // in the stored page so the next flip does not show the hole again.
    document.addEventListener("error", (e) => {
      const img = e.target;
      if (img.tagName !== "IMG" || !root.contains(img)) return;
      const src = img.getAttribute("src");
      for (const p of pages) p.querySelectorAll("img").forEach((i) => i.getAttribute("src") === src && drop(i));
      drop(img);
    }, true);
    let t = null;
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => layout(true), 200); });
  }

  function drop(img) {
    img.closest(".feature, .lead-body")?.classList.add("no-img");
    img.closest("figure")?.remove();
  }

  function goToSection(id) {
    if (id in sectionPage) flipTo(pageToSpread(sectionPage[id]));
  }

  /* ---------- public ---------- */

  function mount(el) {
    root = el;
    root.classList.add("paper-root");
    root.insertAdjacentHTML("beforeend", `
      <div class="stage">
        <div class="book">
          <div class="slot left"></div><div class="slot right"></div>
        </div>
        <button class="turn prev" aria-label="Предыдущая страница" hidden><span>‹</span></button>
        <button class="turn next" aria-label="Следующая страница" hidden><span>›</span></button>
      </div>
      <div class="measure" aria-hidden="true"></div>`);
    book = root.querySelector(".book");
    slotL = root.querySelector(".slot.left");
    slotR = root.querySelector(".slot.right");
    measure = root.querySelector(".measure");
    indicator = document.createElement("span");
    bindInput();
  }

  async function render(data, options) {
    if (options) opts = options;
    issue = data;
    blocks = buildBlocks();
    // Pagination measures text, so the newspaper fonts must be in place first.
    await document.fonts.ready;
    layout(pages.length > 0);
  }

  window.Paper = {
    mount,
    render,
    next: (instant) => flipTo(cur + 1, instant),
    prev: (instant) => flipTo(cur - 1, instant),
    first: () => flipTo(0),
    goToSection,
    get state() { return { spread: cur, spreads: spreadCount(), pages: pages.length, busy }; },
    get indicator() { return indicator; },
    onChange: (fn) => listeners.add(fn),
    sections: () => {
      const s = (issue?.sections || []).slice(1).filter((x) => x.items.length).map((x) => ({ id: x.id, title: x.title }));
      return [{ id: (issue?.sections || [])[0]?.id, title: "Первая полоса" }, ...s, { id: "ads", title: "Требуются" }, { id: "market", title: "Барахолка" }]
        .filter((x) => x.id in sectionPage).map((x) => ({ ...x, page: sectionPage[x.id] + 1 }));
    },
    utils: { esc, when, mskDay, fTime, fDayMonth, fShortDay },
  };
})();
