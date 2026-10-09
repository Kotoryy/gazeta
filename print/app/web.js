"use strict";
// Web edition shell: the issue is embedded in the page as JSON.

(function () {
  const issue = JSON.parse(document.getElementById("issue-data").textContent);
  const { esc, fTime, fShortDay } = Paper.utils;
  const $ = (id) => document.getElementById(id);

  Paper.mount($("paper"));
  $("indicatorSlot").replaceWith(Paper.indicator);
  Paper.indicator.className = "indicator";
  $("prevBtn").addEventListener("click", () => Paper.prev());
  $("nextBtn").addEventListener("click", () => Paper.next());
  $("contents").addEventListener("change", (e) => { if (e.target.value) Paper.goToSection(e.target.value); });
  Paper.onChange(() => { $("contents").value = ""; });
  $("printed").textContent = `Выпуск от ${fShortDay.format(issue.printedAt).replace(".", "")}, ${fTime.format(issue.printedAt)}`;

  Paper.render(issue).then(() => {
    $("contents").innerHTML = '<option value="">В номере…</option>' +
      Paper.sections().map((s) => `<option value="${esc(s.id)}">${esc(s.title)} — стр. ${s.page}</option>`).join("");
  });
})();
