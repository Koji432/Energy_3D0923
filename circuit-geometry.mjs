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

/**
 * Closed XY contour for one electrically isolated copper commutator sector.
 * Segment 0 occupies +Y; segment 1 occupies -Y. Extrude along Z without any
 * additional rotation about Z. The central opening leaves room for a dielectric
 * hub between the metal shaft and copper, preventing a visual electrical short.
 */
export function createCommutatorSectorPoints(
  segment,
  { innerRadius = 0.115, outerRadius = 0.22, halfGap = 0.06, steps = 32 } = {},
) {
  if (segment !== 0 && segment !== 1) {
    throw new RangeError("segment must be 0 or 1");
  }
  if (
    ![innerRadius, outerRadius, halfGap].every(Number.isFinite) ||
    innerRadius <= 0 ||
    outerRadius <= innerRadius ||
    halfGap <= 0 ||
    halfGap >= Math.PI / 2 ||
    !Number.isInteger(steps) ||
    steps < 2
  ) {
    throw new RangeError("invalid annular sector dimensions");
  }

  const start = segment * Math.PI + halfGap;
  const sweep = Math.PI - 2 * halfGap;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (sweep * i) / steps;
    points.push([outerRadius * Math.cos(angle), outerRadius * Math.sin(angle)]);
  }
  for (let i = steps; i >= 0; i--) {
    const angle = start + (sweep * i) / steps;
    points.push([innerRadius * Math.cos(angle), innerRadius * Math.sin(angle)]);
  }
  points.push([...points[0]]);
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
