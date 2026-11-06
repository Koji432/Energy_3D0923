import test from "node:test";
import assert from "node:assert/strict";
import {
  createWindingPoints,
  WINDING_LEAD_A,
  WINDING_LEAD_B,
} from "./circuit-geometry.mjs";

const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`,
  );
};
const add = (a, b) => a.map((component, i) => component + b[i]);
const subtract = (a, b) => a.map((component, i) => component - b[i]);
const scale = (a, factor) => a.map((component) => component * factor);
const dot = (a, b) =>
  a.reduce((sum, component, i) => sum + component * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const rotateZ = ([x, y, z], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
  z,
];

// For straight segments and rigid rotation, v x B is affine in position.
// Its midpoint integral is exact, independently of the winding implementation.
function motionalEmf(points, angle, angularVelocity = 1, fieldStrength = 1) {
  let integral = 0;
  for (let i = 1; i < points.length; i++) {
    const start = rotateZ(points[i - 1], angle);
    const end = rotateZ(points[i], angle);
    const midpoint = scale(add(start, end), 0.5);
    const velocity = cross([0, 0, angularVelocity], midpoint);
    integral += dot(
      cross(velocity, [fieldStrength, 0, 0]),
      subtract(end, start),
    );
  }
  return integral;
}

function orientedArea(points) {
  let area = [0, 0, 0];
  // The imagined closing segment B -> A stays in the front plane.
  for (let i = 0; i < points.length; i++) {
    area = add(area, cross(points[i], points[(i + 1) % points.length]));
  }
  return scale(area, 0.5);
}

test("the winding is one open path with N turns and distinct terminals", () => {
  for (const turns of [1, 3, 13]) {
    const points = createWindingPoints({ turns });
    assert.equal(points.length, 1 + turns * 4);
    assert.deepEqual(points[0], [-0.27, -0.7, 0.83]);
    assert.deepEqual(points.at(-1), [0.27, -0.7, 0.83]);
    assert.notDeepEqual(points[0], points.at(-1));
    const visited = new Set(points.map((point) => JSON.stringify(point)));
    assert.equal(visited.size, points.length, "no turn closes on itself");
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const point = points[i];
      assert.ok(point.every(Number.isFinite));
      assert.ok(Math.hypot(...subtract(point, previous)) > 0);
      assert.ok(point[0] >= previous[0], "the wire advances through its turns");
      if (point[0] !== previous[0]) {
        assert.equal(previous[2], 0.83);
        assert.equal(
          point[2],
          0.83,
          "pitch advances only on the front crossbar",
        );
      }
    }
    const activeSides = points
      .slice(1)
      .filter((point, i) => point[2] !== points[i][2]);
    assert.equal(activeSides.length, 2 * turns);
  }
});

test("the winding has positive X oriented area and no rotating Y-area error", () => {
  const turns = 13;
  const h = 0.7;
  const depth = 0.83;
  const area = orientedArea(createWindingPoints());
  close(area[0], turns * 4 * h * depth);
  close(area[1], 0);
  // Pitch creates only a Z-area component; rotation about Z keeps it out of Bx.
  close(area[2], -h * 0.54);
});

test("v cross B gives the Faraday sign at every angle and both rotation directions", () => {
  const points = createWindingPoints();
  const area = 13 * 4 * 0.7 * 0.83;
  for (const direction of [-1, 1]) {
    for (const angle of [
      -2.1,
      0,
      0.3,
      Math.PI / 2,
      Math.PI,
      4.7,
      Math.PI * 2,
    ]) {
      const emf = motionalEmf(points, angle, direction, 0.8);
      close(emf, area * direction * 0.8 * Math.sin(angle));
      const deltaTime = 1e-5;
      const before = area * 0.8 * Math.cos(angle - direction * deltaTime);
      const after = area * 0.8 * Math.cos(angle + direction * deltaTime);
      close(emf, -(after - before) / (2 * deltaTime), 2e-8);
    }
  }
});

test("dimensions and turn count change the emf by their actual geometric area", () => {
  const turns = 4;
  const halfHeight = 0.45;
  const halfDepth = 1.2;
  const points = createWindingPoints({
    turns,
    xMin: -0.4,
    xMax: 0.3,
    halfHeight,
    halfDepth,
  });
  close(
    motionalEmf(points, 0.9, 2, 0.6),
    turns * 4 * halfHeight * halfDepth * 2 * 0.6 * Math.sin(0.9),
  );
});

test("A and B meet the corresponding copper rear faces away from gaps and shaft", () => {
  const points = createWindingPoints();
  assert.deepEqual(WINDING_LEAD_A[0], points[0]);
  assert.deepEqual(WINDING_LEAD_B[0], points.at(-1));
  assert.deepEqual(WINDING_LEAD_A.at(-1), [0, 0.18, 1.02]);
  assert.deepEqual(WINDING_LEAD_B.at(-1), [0, -0.18, 1.02]);
  for (const [lead, segmentSign] of [
    [WINDING_LEAD_A, 1],
    [WINDING_LEAD_B, -1],
  ]) {
    const [x, y, z] = lead.at(-1);
    assert.ok(Math.hypot(x, y) < 0.22, "terminal lies on the copper end face");
    assert.equal(z, 1.22 - 0.4 / 2);
    assert.ok(y * segmentSign > 0, "segment 0 is +Y; segment 1 is -Y");
    assert.ok(
      Math.abs(y) > Math.abs(x) * Math.tan(0.06),
      "endpoint avoids split gaps",
    );
    for (let i = 1; i < lead.length; i++) {
      const a = lead[i - 1].slice(0, 2);
      const delta = subtract(lead[i].slice(0, 2), a);
      const t = Math.max(0, Math.min(1, -dot(a, delta) / dot(delta, delta)));
      const closest = add(a, scale(delta, t));
      assert.ok(
        Math.hypot(...closest) > 0.075 + 0.022,
        "lead clears the metal shaft",
      );
    }
  }
  assert.ok(WINDING_LEAD_A.slice(1, -1).every(([x]) => x < 0));
  assert.ok(WINDING_LEAD_B.slice(1, -1).every(([x]) => x > 0));
});

test("the split ring makes +X the positive brush for positive Z rotation", () => {
  const points = createWindingPoints();
  for (const angle of [
    0.2,
    Math.PI / 2,
    2.8,
    Math.PI + 0.2,
    Math.PI * 1.5,
    6.1,
  ]) {
    // Inverse rotor rotation locates the stationary +X brush on its segment.
    const localPositiveBrush = rotateZ([0.22, 0, 1.24], -angle);
    const plusBrushTouchesB = localPositiveBrush[1] < 0;
    const coilEmf = motionalEmf(points, angle);
    const brushVoltage = coilEmf * (plusBrushTouchesB ? 1 : -1);
    assert.ok(
      brushVoltage > 0,
      "red +X terminal is positive in both half turns",
    );
    close(brushVoltage, Math.abs(coilEmf));
    // A real fixed commutator does not preserve the polarity if drive reverses.
    const reverseVoltage =
      motionalEmf(points, angle, -1) * (plusBrushTouchesB ? 1 : -1);
    close(reverseVoltage, -brushVoltage);
  }
  assert.ok(rotateZ([0, -0.18, 1.02], Math.PI / 2)[0] > 0);
  assert.ok(rotateZ([0, 0.18, 1.02], Math.PI * 1.5)[0] > 0);
});

test("invalid winding dimensions cannot create a malformed conductor", () => {
  for (const turns of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => createWindingPoints({ turns }), RangeError);
  }
  for (const options of [
    { xMin: 0.4, xMax: 0.4 },
    { xMin: 0.5, xMax: 0.4 },
    { xMax: Infinity },
    { halfHeight: 0 },
    { halfDepth: -1 },
    { halfHeight: NaN },
  ]) {
    assert.throws(() => createWindingPoints(options), RangeError);
  }
});
