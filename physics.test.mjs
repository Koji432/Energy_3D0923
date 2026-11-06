import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceAngle,
  sampleInduction,
  TURNS_PER_SECOND,
  GENERATOR_PARAMETERS as P,
  MAX_OMEGA,
  FLUX_LINKAGE_AMPLITUDE,
  PEAK_EMF,
  PEAK_CURRENT,
} from "./physics.mjs";

const TAU = Math.PI * 2;
const close = (actual, expected, tolerance = 1e-11) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`,
  );
};

// These tests check signs, physical laws and an independently differentiated
// flux linkage, rather than the particular rendering of the apparatus.
test("illustrative SI parameters give about 3 V and at most 20 mA at full speed", () => {
  const sample = sampleInduction(Math.PI / 2, 1);
  close(MAX_OMEGA, TAU * TURNS_PER_SECOND);
  close(FLUX_LINKAGE_AMPLITUDE, P.turns * P.magneticFluxDensity * P.coilArea);
  assert.ok(sample.coilEmf > 2.9 && sample.coilEmf < 3.1);
  assert.ok(sample.current > 0.019 && sample.current < 0.02);
  close(sample.coilEmf, PEAK_EMF);
  close(sample.current, PEAK_CURRENT);
  close(sample.terminalVoltage, P.ledForwardVoltage);
});

test("a stationary coil has orientation-dependent flux but no EMF, current or torque", () => {
  for (const angle of [0, Math.PI / 6, Math.PI / 2, Math.PI, Math.PI * 1.7]) {
    for (const direction of [-1, 1]) {
      const sample = sampleInduction(angle, 0, direction);
      for (const key of [
        "coilEmf",
        "terminalEmf",
        "current",
        "coilCurrent",
        "led",
        "torque",
        "mechanicalPower",
        "electricalPower",
      ]) {
        assert.equal(sample[key], 0, `${key} at ${angle}`);
      }
      close(
        sample.fluxLinkage,
        P.turns * P.magneticFluxDensity * P.coilArea * Math.cos(angle),
      );
      close(advanceAngle(angle, 1, 0, direction), angle);
    }
  }
});

test("dimensioned coil EMF equals minus the time derivative of flux linkage in both directions", () => {
  const dt = 1e-5;
  for (const angle of [0.1, 0.6, 1.4, 2.8, 3.6, 5.9]) {
    for (const speed of [0.4, 0.8, 1]) {
      for (const direction of [-1, 1]) {
        const before = sampleInduction(
          advanceAngle(angle, dt, speed, -direction),
          speed,
          direction,
        );
        const after = sampleInduction(
          advanceAngle(angle, dt, speed, direction),
          speed,
          direction,
        );
        const negativeDerivative =
          -(after.fluxLinkage - before.fluxLinkage) / (2 * dt);
        close(
          sampleInduction(angle, speed, direction).coilEmf,
          negativeDerivative,
          2e-9,
        );
      }
    }
  }
});

test("coil EMF alternates while the commutator preserves forward terminal polarity", () => {
  for (const [angle, normalizedFlux, normalizedEmf] of [
    [0, 1, 0],
    [Math.PI / 2, 0, 1],
    [Math.PI, -1, 0],
    [Math.PI * 1.5, 0, -1],
  ]) {
    const sample = sampleInduction(angle, 1);
    close(sample.flux, normalizedFlux);
    close(sample.coilEmf, normalizedEmf * PEAK_EMF);
    close(sample.emf, normalizedEmf);
    close(sample.terminalEmf, Math.abs(normalizedEmf) * PEAK_EMF);
  }
  const first = sampleInduction(Math.PI / 3, 0.9);
  const second = sampleInduction((Math.PI * 4) / 3, 0.9);
  assert.equal(first.commutatorSign, 1);
  assert.equal(second.commutatorSign, -1);
  close(first.current, second.current);
  close(first.coilCurrent, -second.coilCurrent);
  assert.ok(first.current > 0);
});

test("reversing shaft rotation reverses terminal polarity and blocks the forward LED", () => {
  for (const angle of [
    Math.PI / 3,
    Math.PI / 2,
    (Math.PI * 4) / 3,
    Math.PI * 1.5,
  ]) {
    const forward = sampleInduction(angle, 0.9);
    const reverse = sampleInduction(angle, 0.9, -1);
    close(reverse.coilEmf, -forward.coilEmf);
    close(reverse.terminalEmf, -forward.terminalEmf);
    close(reverse.output, forward.output); // magnitude is not a current
    assert.ok(reverse.terminalEmf < 0);
    for (const key of [
      "current",
      "coilCurrent",
      "led",
      "normalizedCurrent",
      "torque",
      "mechanicalPower",
    ])
      assert.equal(reverse[key], 0);
  }
});

test("insulating split-ring gaps open both contacts at each EMF zero crossing", () => {
  for (const centre of [0, Math.PI, TAU]) {
    for (const offset of [
      -P.commutatorHalfGap,
      -0.03,
      0,
      0.03,
      P.commutatorHalfGap,
    ]) {
      for (const direction of [-1, 1]) {
        const sample = sampleInduction(centre + offset, 1, direction);
        assert.equal(sample.contactClosed, false);
        assert.equal(sample.commutatorSign, 0);
        for (const key of ["terminalEmf", "current", "coilCurrent", "led"])
          assert.equal(sample[key], 0);
      }
    }
    for (const side of [-1, 1]) {
      const sample = sampleInduction(
        centre + side * (P.commutatorHalfGap + 1e-6),
        1,
      );
      assert.equal(sample.contactClosed, true);
      assert.notEqual(sample.coilEmf, 0);
    }
  }
  // A gap removes the source connection even when coil EMF is nonzero.
  assert.ok(Math.abs(sampleInduction(0.03, 1).coilEmf) > 0);
});

test("the forward constant-drop LED conducts only above Vf and satisfies the series circuit law", () => {
  const thresholdSpeed = P.ledForwardVoltage / PEAK_EMF;
  const below = sampleInduction(Math.PI / 2, thresholdSpeed - 0.01);
  const above = sampleInduction(Math.PI / 2, thresholdSpeed + 0.01);
  assert.equal(below.contactClosed, true);
  assert.ok(below.terminalEmf > 0 && below.terminalEmf < P.ledForwardVoltage);
  assert.equal(below.current, 0);
  assert.equal(below.led, 0);
  assert.ok(above.current > 0);
  close(
    above.terminalEmf,
    P.ledForwardVoltage + above.current * P.seriesResistance,
  );
  close(above.terminalVoltage, P.ledForwardVoltage);
  close(above.normalizedCurrent, above.current / PEAK_CURRENT);
  const full = sampleInduction(Math.PI / 2, 1);
  assert.equal(full.led, 1);
  assert.equal(sampleInduction(0.3, 0.8).current, 0);
});

test("increased speed scales EMF and increases forward current at a fixed orientation", () => {
  const slow = sampleInduction(Math.PI / 2, 0.7);
  const fast = sampleInduction(Math.PI / 2, 1);
  close(slow.coilEmf, fast.coilEmf * 0.7);
  assert.ok(slow.current > 0 && slow.current < fast.current);
  assert.ok(slow.led > 0 && slow.led < fast.led);
});

test("generator reaction torque opposes rotation and power balances LED plus resistance", () => {
  let conductingSamples = 0;
  for (let i = 0; i < 80; i++) {
    for (const speed of [0, 0.5, 0.8, 1]) {
      for (const direction of [-1, 1]) {
        const sample = sampleInduction((i * TAU) / 80, speed, direction);
        assert.ok(sample.torque * sample.omega <= 0);
        close(sample.mechanicalPower, -sample.torque * sample.omega);
        close(sample.electricalPower, sample.coilEmf * sample.coilCurrent);
        close(sample.mechanicalPower, sample.electricalPower);
        close(sample.electricalPower, sample.ledPower + sample.resistivePower);
        close(sample.ledPower, sample.terminalVoltage * sample.current);
        assert.ok(sample.ledPower >= 0 && sample.resistivePower >= 0);
        if (sample.current > 0) {
          conductingSamples++;
          assert.ok(sample.torque < 0);
        }
      }
    }
  }
  assert.ok(conductingSamples > 0);
});

test("elapsed-time rotation agrees across frame rates and variable frame lengths", () => {
  const start = 0.41,
    duration = 7;
  const expected = advanceAngle(start, duration, 0.63, -1);
  for (const fps of [30, 60, 144]) {
    let angle = start;
    for (let frame = 0; frame < duration * fps; frame++)
      angle = advanceAngle(angle, 1 / fps, 0.63, -1);
    close(angle, expected);
  }
  let angle = start;
  for (const dt of [0.1, 1.7, 0.01, 3.2, 1.99])
    angle = advanceAngle(angle, dt, 0.63, -1);
  close(angle, expected);
});

test("normalized outputs stay bounded and invalid inputs cannot inject nonfinite state", () => {
  close(advanceAngle(-Math.PI / 2, 0, 1), Math.PI * 1.5);
  close(advanceAngle(TAU * 3, 0, 1), 0);
  close(advanceAngle(0, 1 / TURNS_PER_SECOND, 1), 0);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    close(advanceAngle(invalid, 0, 1), 0);
    close(advanceAngle(0.4, invalid, 1), 0.4);
    assert.equal(sampleInduction(1, invalid).current, 0);
    assert.ok(
      Object.values(sampleInduction(invalid, 1))
        .filter((v) => typeof v === "number")
        .every(Number.isFinite),
    );
  }
  close(advanceAngle(0.4, -1, 1), 0.4);
  close(sampleInduction(Math.PI / 2, 8).output, 1);
  assert.equal(sampleInduction(Math.PI / 2, -1).current, 0);
  for (let i = 0; i < 100; i++) {
    const sample = sampleInduction((i * TAU) / 100, 1);
    for (const value of [sample.output, sample.led, sample.normalizedCurrent])
      assert.ok(value >= 0 && value <= 1);
  }
  const hugeDeltaAngle = advanceAngle(0, Number.MAX_VALUE, 1);
  assert.ok(
    Number.isFinite(hugeDeltaAngle) &&
      hugeDeltaAngle >= 0 &&
      hugeDeltaAngle < TAU,
  );
});
