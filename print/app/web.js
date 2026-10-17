"use strict";
// Web edition shell: the issue is embedded in the page as JSON.

(function () {
  const issue = JSON.parse(document.getElementById("issue-data").textContent);
  const { esc, fTime, fShortDay } = Paper.utils;
  const $ = (id) => document.getElementById(id);

  Paper.mount($("paper"));
  // Two ways to read: spreads that turn, or one long sheet that scrolls.
  const VIEW_KEY = "gazeta.view";
  function applyView(v) {
    Paper.setView(v);
    const btn = document.getElementById("viewBtn");
    btn.textContent = Paper.view === "scroll" ? "Читать разворотами" : "Читать лентой";
    btn.title = Paper.view === "scroll" ? "Вернуть страницы, которые перелистываются" : "Одна длинная страница с прокруткой, как раньше";
    try { localStorage.setItem(VIEW_KEY, Paper.view); } catch { /* the choice is just not remembered */ }
  }
  
  try { applyView(localStorage.getItem(VIEW_KEY) || "flip"); } catch { applyView("flip"); }
  $("indicatorSlot").replaceWith(Paper.indicator);
  Paper.indicator.className = "indicator";
  $("prevBtn").addEventListener("click", () => Paper.prev());
  $("nextBtn").addEventListener("click", () => Paper.next());
  $("contents").addEventListener("change", (e) => { if (e.target.value) Paper.goToSection(e.target.value); });
  Paper.onChange(() => { $("contents").value = ""; });
  $("printed").textContent = `Выпуск от ${fShortDay.format(issue.printedAt).replace(".", "")}, ${fTime.format(issue.printedAt)}`;

  const fillContents = () => {
    $("contents").innerHTML = '<option value="">В номере…</option>' +
      Paper.sections().map((s) => `<option value="${esc(s.id)}">${esc(s.title)}${s.page ? " — стр. " + s.page : ""}</option>`).join("");
  };
  $("viewBtn").addEventListener("click", () => { applyView(Paper.view === "scroll" ? "flip" : "scroll"); fillContents(); });
  Paper.render(issue).then(fillContents);
})();
