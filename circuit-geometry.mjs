/**
 * A single, open rectangular winding in rotor-local coordinates.
 *
 * Traversal A -> B has its main oriented area along +X at theta = 0.
 * Each turn advances in X only along the front crossbar (constant Z).
 * The two active Z-directed sides therefore share the same X coordinate:
 * their unwanted cos(theta) terms in integral(v x B).dl cancel exactly.
 * Render these points as straight segments, without a smoothing spline.
 */
export function createWindingPoints({
  turns = 13,
  xMin = -0.27,
  xMax = 0.27,
  halfHeight = 0.7,
  halfDepth = 0.83,
} = {}) {
  if (!Number.isInteger(turns) || turns < 1) {
    throw new RangeError("turns must be a positive integer");
  }
  if (
    ![xMin, xMax, halfHeight, halfDepth].every(Number.isFinite) ||
    xMax <= xMin ||
    halfHeight <= 0 ||
    halfDepth <= 0
  ) {
    throw new RangeError("winding dimensions must be finite and positive");
  }

  const points = [[xMin, -halfHeight, halfDepth]];
  for (let turn = 0; turn < turns; turn++) {
    const x = xMin + ((xMax - xMin) * turn) / turns;
    // Use xMax directly at the final endpoint to avoid accumulated pitch error.
    const nextX =
      turn + 1 === turns ? xMax : xMin + ((xMax - xMin) * (turn + 1)) / turns;
    points.push(
      [x, -halfHeight, -halfDepth],
      [x, halfHeight, -halfDepth],
      [x, halfHeight, halfDepth],
      [nextX, -halfHeight, halfDepth],
    );
  }
  return points;
}

const immutablePath = (points) => Object.freeze(points.map(Object.freeze));

/**
 * The default winding's A terminal connects to segment 0 (+Y semicircle).
 * The endpoint is inside the rear copper face, not in the +/-X split gaps.
 * Its negative-X flank keeps the lead away from the shaft and the other lead.
 */
export const WINDING_LEAD_A = immutablePath([
  [-0.27, -0.7, 0.83],
  [-0.42, -0.7, 0.94],
  [-0.42, 0.28, 0.94],
  [-0.12, 0.22, 0.99],
  [0, 0.18, 1.02],
]);

/** The default B terminal connects to segment 1 (-Y semicircle). */
export const WINDING_LEAD_B = immutablePath([
  [0.27, -0.7, 0.83],
  [0.42, -0.7, 0.94],
  [0.42, -0.28, 0.94],
  [0.12, -0.22, 0.99],
  [0, -0.18, 1.02],
]);
