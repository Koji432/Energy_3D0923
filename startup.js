/* Classic bootstrap also gives an actionable message when opened as a local file. */
(function () {
  function unavailable(message) {
    document.querySelectorAll(".viewport").forEach(function (view) {
      view.replaceChildren();
      view.classList.add("failed");
      var text = document.createElement("p");
      text.className = "error-message";
      text.setAttribute("role", "alert");
      text.textContent = message;
      view.appendChild(text);
    });
    document.querySelectorAll("button, input").forEach(function (control) {
      control.disabled = true;
    });
    document.getElementById("run-status").textContent =
      "起動方法をご確認ください";
  }
  if (location.protocol === "file:") {
    unavailable(
      "この教材はHTTPサーバから開いてください。フォルダ内で「python3 -m http.server 8000」を実行し、http://localhost:8000 を開くと実験できます。詳しくはREADME.mdをご覧ください。",
    );
    return;
  }
  import("./app.js").catch(function (error) {
    console.error("Experiment could not load:", error);
    unavailable(
      "教材を読み込めませんでした。フォルダ内のファイル一式がそろっていることを確認して、ページを再読み込みしてください。",
    );
  });
})();
