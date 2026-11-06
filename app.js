import { advanceAngle, sampleInduction } from "./physics.mjs";
const $ = (selector) => document.querySelector(selector);
const state = {
  playing: false,
  speed: 0.6,
  angle: 0.72,
  mode: "cutaway",
  field: true,
};
const ui = {
  play: $("#play-button"),
  playIcon: $("#play-icon"),
  playLabel: $("#play-label"),
  status: $("#run-status"),
  speed: $("#speed"),
  speedValue: $("#speed-value"),
  power: $("#power-value"),
  fill: $("#power-fill"),
  path: $("#wave-path"),
  marker: $("#wave-marker"),
  dot: $("#wave-dot"),
  message: $("#observation-message"),
  led: $("#led-caption"),
};
let experiment,
  lastTime,
  lastReadout = 0,
  progress = 0,
  runningFrame;
let lastPower = -1;
function updateStatus() {
  const active = state.playing && state.speed > 0;
  ui.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
  ui.playLabel.textContent = state.playing ? "回転を止める" : "回してみる";
  ui.status.replaceChildren(
    Object.assign(document.createElement("i"), {}),
    document.createTextNode(
      active ? "発電中" : state.playing ? "速さ 0%・停止中" : "停止中",
    ),
  );
  ui.status.classList.toggle("running", active);
  $(".energy-flow").classList.toggle("is-running", active);
  ui.message.textContent = !state.playing
    ? "「回してみる」を押すと、コイルと電気の動きが見えます。"
    : state.speed === 0
      ? "速さが0%なのでコイルは止まり、電気も生まれません。"
      : state.speed < 0.2
        ? "ゆっくり回すと電圧が小さくなり、LEDは光りにくくなります。"
        : "プロペラ → コイル → 電流 → LED。速さを変えて比べてみよう。";
  updateGraph();
}
function updateGraph() {
  const speed = state.playing ? state.speed : 0;
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const x = 8 + (i / 120) * 284;
    const y = 80 - Math.abs(Math.sin((i / 120) * Math.PI * 2)) * speed * 66;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  ui.path.setAttribute("d", d);
}
function updateMode() {
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === state.mode),
      ),
    );
  const closed = state.mode === "closed";
  document
    .querySelectorAll(".detail-label")
    .forEach((label) => (label.hidden = closed));
  $(".closed-message").hidden = !closed;
  $(".magnetic-caption").hidden = closed || !state.field;
}
function readout(sample) {
  const power = Math.round(sample.output * 100);
  if (power !== lastPower) {
    ui.power.replaceChildren(
      document.createTextNode(String(power)),
      Object.assign(document.createElement("small"), { textContent: "%" }),
    );
    lastPower = power;
  }
  ui.fill.style.width = power + "%";
  const x = 8 + (state.angle / (2 * Math.PI)) * 284,
    y = 80 - sample.output * 66;
  ui.marker.setAttribute("x1", x);
  ui.marker.setAttribute("x2", x);
  ui.dot.setAttribute("cx", x);
  ui.dot.setAttribute("cy", y);
  ui.led.textContent =
    state.playing && state.speed > 0
      ? sample.led > 0.02
        ? "発電した電気で点灯"
        : "電圧が小さいと消灯"
      : "回して光らせよう";
}
function frame(time) {
  const dt =
    lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.06);
  lastTime = time;
  const speed = state.playing ? state.speed : 0;
  state.angle = advanceAngle(state.angle, dt, speed);
  const sample = sampleInduction(state.angle, speed);
  progress = (progress + dt * sample.output * 0.8) % 1;
  experiment.update(state, sample, progress);
  if (time - lastReadout > 80) {
    readout(sample);
    lastReadout = time;
  }
  runningFrame = requestAnimationFrame(frame);
}
function fail() {
  cancelAnimationFrame(runningFrame);
  state.playing = false;
  ui.play.disabled = true;
  ui.speed.disabled = true;
  document
    .querySelectorAll("[data-mode], #show-field, #reset-view")
    .forEach((control) => (control.disabled = true));
  document.querySelectorAll(".viewport").forEach((element) => {
    element.classList.add("failed");
    element.replaceChildren();
    const text = document.createElement("p");
    text.className = "error-message";
    text.setAttribute("role", "alert");
    text.textContent =
      "3D表示を開始できませんでした。WebGL対応のブラウザで開き直してください。ファイルを直接開いている場合は、READMEの手順でHTTPサーバから開いてください。";
    element.append(text);
  });
  ui.status.textContent = "3D表示を確認してください";
  ui.message.textContent = "上のエネルギーの流れと説明も参考にしてください。";
  readout(sampleInduction(state.angle, 0));
}
ui.play.addEventListener("click", () => {
  state.playing = !state.playing;
  updateStatus();
  readout(sampleInduction(state.angle, state.playing ? state.speed : 0));
});
ui.speed.addEventListener("input", () => {
  state.speed = Number(ui.speed.value) / 100;
  ui.speedValue.replaceChildren(
    document.createTextNode(ui.speed.value),
    Object.assign(document.createElement("span"), { textContent: "%" }),
  );
  updateStatus();
  readout(sampleInduction(state.angle, state.playing ? state.speed : 0));
});
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    updateMode();
  }),
);
$("#show-field").addEventListener("change", (event) => {
  state.field = event.target.checked;
  updateMode();
});
$("#reset-view").addEventListener("click", () => experiment?.reset());
document.addEventListener("scene-error", fail, { once: true });
// A background tab does not keep accumulating rotation; returning resumes from the same angle.
document.addEventListener("visibilitychange", () => {
  lastTime = undefined;
});
updateStatus();
updateMode();
try {
  const { createExperiment } = await import("./scene.js");
  experiment = createExperiment();
  runningFrame = requestAnimationFrame(frame);
} catch (error) {
  console.error("3D experiment initialization failed:", error);
  fail();
}
