import { advanceAngle, sampleInduction } from "./physics.mjs";
const state = {
  playing: false,
  speed: 0.6,
  angle: 0.72,
  inside: false,
  mode: "cutaway",
  field: true,
};
const workspace = document.getElementById("workspace"),
  panel = document.getElementById("motor-panel");
const play = document.getElementById("play-button"),
  speed = document.getElementById("speed");
let experiment,
  lastTime,
  progress = 0,
  runningFrame;
function openMotor() {
  if (state.inside) return;
  document.getElementById("motor-open").setAttribute("aria-expanded", "true");
  state.inside = true;
  state.mode = "cutaway";
  panel.hidden = false;
  workspace.classList.add("inside-open");
  updateMode();
  document.getElementById("close-motor").focus({ preventScroll: true });
  if (window.matchMedia("(max-width:650px)").matches)
    panel.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
}
function closeMotor() {
  document.getElementById("motor-open").setAttribute("aria-expanded", "false");
  state.inside = false;
  panel.hidden = true;
  workspace.classList.remove("inside-open");
  document.getElementById("motor-open").focus({ preventScroll: true });
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
}
function frame(time) {
  const dt =
    lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.06);
  lastTime = time;
  const currentSpeed = state.playing ? state.speed : 0;
  state.angle = advanceAngle(state.angle, dt, currentSpeed);
  const sample = sampleInduction(state.angle, currentSpeed);
  progress = (progress + dt * sample.output * 0.8) % 1;
  experiment.update(state, sample, progress);
  runningFrame = requestAnimationFrame(frame);
}
function fail() {
  cancelAnimationFrame(runningFrame);
  state.playing = false;
  document
    .querySelectorAll("button,input")
    .forEach((control) => (control.disabled = true));
  document.querySelectorAll(".viewport").forEach((view) => {
    view.replaceChildren();
    view.classList.add("failed");
    const text = document.createElement("p");
    text.className = "error-message";
    text.setAttribute("role", "alert");
    text.textContent =
      "3Dを表示できませんでした。WebGL対応のブラウザで開き直してください。";
    view.append(text);
  });
}
play.addEventListener("click", () => {
  state.playing = !state.playing;
  document.getElementById("play-icon").textContent = state.playing ? "Ⅱ" : "▶";
  document.getElementById("play-label").textContent = state.playing
    ? "止める"
    : "回す";
});
speed.addEventListener("input", () => {
  state.speed = Number(speed.value) / 100;
  document
    .getElementById("speed-value")
    .replaceChildren(
      document.createTextNode(speed.value),
      Object.assign(document.createElement("span"), { textContent: "%" }),
    );
});
document.getElementById("motor-open").addEventListener("click", openMotor);
document.getElementById("close-motor").addEventListener("click", closeMotor);
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    updateMode();
  }),
);
document
  .getElementById("show-field")
  .addEventListener("change", (event) => (state.field = event.target.checked));
document
  .getElementById("reset-view")
  .addEventListener("click", () => experiment?.reset());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.inside) closeMotor();
});
document.addEventListener("scene-error", fail, { once: true });
document.addEventListener("visibilitychange", () => (lastTime = undefined));
try {
  const { createExperiment } = await import("./scene.js");
  experiment = createExperiment({ onMotorSelect: openMotor });
  runningFrame = requestAnimationFrame(frame);
} catch (error) {
  console.error("3D initialization failed:", error);
  fail();
}
