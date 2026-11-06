import test from "node:test";
import assert from "node:assert/strict";
import { advanceAngle, sampleInduction, TURNS_PER_SECOND } from "./physics.mjs";

const TAU = Math.PI * 2;
const close = (actual, expected, tolerance = 1e-11) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`,
  );
};

test("a stationary coil produces no emf or light at every orientation", () => {
  for (const angle of [0, Math.PI / 6, Math.PI / 2, Math.PI, Math.PI * 1.7]) {
    const sample = sampleInduction(angle, 0);
    assert.equal(Math.abs(sample.emf), 0);
    assert.equal(sample.output, 0);
    assert.equal(sample.led, 0);
    close(sample.flux, Math.cos(angle));
    close(advanceAngle(angle, 1, 0), angle);
  }
});

test("emf peaks when flux crosses zero and is zero when flux is extremal", () => {
  for (const [angle, flux, emf] of [
    [0, 1, 0],
    [Math.PI / 2, 0, 1],
    [Math.PI, -1, 0],
    [Math.PI * 1.5, 0, -1],
  ]) {
    const sample = sampleInduction(angle, 1);
    close(sample.flux, flux);
    close(sample.emf, emf);
    close(sample.output, Math.abs(emf));
  }
});

test("the emf sign agrees with minus the time derivative of flux", () => {
  const elapsed = 1e-5;
  for (const direction of [-1, 1]) {
    const angle = 0.6;
    const speed = 0.72;
    const before = sampleInduction(
      advanceAngle(angle, elapsed, speed, -direction),
      speed,
    );
    const after = sampleInduction(
      advanceAngle(angle, elapsed, speed, direction),
      speed,
    );
    const negativeDerivative = -(after.flux - before.flux) / (2 * elapsed);
    close(
      negativeDerivative / (TAU * TURNS_PER_SECOND),
      sampleInduction(angle, speed, direction).emf,
      1e-9,
    );
  }
});

test("reversing rotation reverses coil polarity and retains rectified magnitude", () => {
  const forward = sampleInduction(Math.PI / 3, 0.65, 1);
  const reverse = sampleInduction(Math.PI / 3, 0.65, -1);
  close(reverse.emf, -forward.emf);
  close(reverse.output, forward.output);
  close(reverse.led, forward.led);
  close(reverse.flux, forward.flux);
  close(advanceAngle(1, 0.1, 0.5, -1), 1 - TAU * 0.5 * TURNS_PER_SECOND * 0.1);
});

test("relative speed scales voltage and LED brightness has a threshold", () => {
  const fast = sampleInduction(Math.PI / 2, 1);
  const half = sampleInduction(Math.PI / 2, 0.5);
  const slow = sampleInduction(Math.PI / 2, 0.15);
  const verySlow = sampleInduction(Math.PI / 2, 0.05);
  close(half.emf, fast.emf / 2);
  assert.equal(fast.led, 1);
  assert.ok(half.led > slow.led);
  assert.ok(slow.led > 0 && slow.led < 0.05);
  assert.equal(verySlow.led, 0);
});

test("elapsed-time rotation agrees across frame rates and variable frame lengths", () => {
  const start = 0.41;
  const duration = 7;
  const expected = advanceAngle(start, duration, 0.63, -1);
  for (const fps of [30, 60, 144]) {
    let angle = start;
    for (let frame = 0; frame < duration * fps; frame++) {
      angle = advanceAngle(angle, 1 / fps, 0.63, -1);
    }
    close(angle, expected);
  }
  let angle = start;
  for (const delta of [0.1, 1.7, 0.01, 3.2, 1.99]) {
    angle = advanceAngle(angle, delta, 0.63, -1);
  }
  close(angle, expected);
});

test("angles wrap and invalid inputs cannot inject nonfinite state", () => {
  close(advanceAngle(-Math.PI / 2, 0, 1), Math.PI * 1.5);
  close(advanceAngle(TAU * 3, 0, 1), 0);
  close(advanceAngle(0, 1 / TURNS_PER_SECOND, 1), 0);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    close(advanceAngle(invalid, 0, 1), 0);
    close(advanceAngle(0.4, invalid, 1), 0.4);
    assert.equal(sampleInduction(1, invalid).output, 0);
    assert.ok(
      Object.values(sampleInduction(invalid, 1)).every(Number.isFinite),
    );
  }
  close(advanceAngle(0.4, -1, 1), 0.4);
  close(sampleInduction(Math.PI / 2, 8).output, 1);
  assert.equal(sampleInduction(Math.PI / 2, -1).output, 0);
  const hugeDeltaAngle = advanceAngle(0, Number.MAX_VALUE, 1);
  assert.ok(
    Number.isFinite(hugeDeltaAngle) &&
      hugeDeltaAngle >= 0 &&
      hugeDeltaAngle < TAU,
  );
});
