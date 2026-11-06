/** Relative, single-coil educational model; values are normalized, not volts. */
export const TURNS_PER_SECOND = 0.7;

const TAU = Math.PI * 2;
const LED_THRESHOLD = 0.12;

function unitSpeed(speed) {
  return Number.isFinite(speed) ? Math.min(1, Math.max(0, speed)) : 0;
}

function rotationDirection(direction) {
  return Number.isFinite(direction) && direction < 0 ? -1 : 1;
}

function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % TAU) + TAU) % TAU;
}

/**
 * theta is the angle between the coil's normal and the fixed magnetic field.
 * Flux = cos(theta), and Faraday's law gives emf proportional to speed*sin(theta).
 * emf keeps the coil's sign. output is an ideal full-wave-rectified magnitude,
 * simplifying the commutator of a brushed DC motor used as a generator.
 * LED brightness adds a relative threshold; this is not a diode circuit solver.
 */
export function sampleInduction(angle, speed, direction = 1) {
  const theta = normalizeAngle(angle);
  const flux = Math.cos(theta);
  const emf = unitSpeed(speed) * rotationDirection(direction) * Math.sin(theta);
  const output = Math.abs(emf);
  const led = Math.max(0, (output - LED_THRESHOLD) / (1 - LED_THRESHOLD));
  return { flux, emf, output, led };
}

/** Advance using elapsed seconds, independently of display refresh rate. */
export function advanceAngle(angle, deltaSeconds, speed, direction = 1) {
  const theta = normalizeAngle(angle);
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  // Reduce whole turns first, keeping even very large finite deltas bounded.
  const turns = (elapsed * unitSpeed(speed) * TURNS_PER_SECOND) % 1;
  return normalizeAngle(theta + turns * TAU * rotationDirection(direction));
}
