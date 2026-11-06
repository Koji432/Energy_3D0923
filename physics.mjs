/** Ideal quasi-static, single-coil brushed DC generator with an LED load. */
export const TURNS_PER_SECOND = 0.7;

const TAU = Math.PI * 2;

/**
 * Illustrative assumptions, NOT measurements of the kit. The drawn winding
 * count and geometry are schematic and do not reproduce these dimensions.
 * Inductance, capacitance, brush arcing, leakage, friction and speed droop are
 * neglected; the user prescribes speed. Brushes are ideal point contacts.
 * seriesResistance lumps winding, brush and effective series resistance.
 */
export const GENERATOR_PARAMETERS = Object.freeze({
  turns: 500,
  magneticFluxDensity: 0.4, // tesla
  coilArea: 0.0034, // square metres per turn
  ledForwardVoltage: 1.8, // volts; piecewise constant-drop diode approximation
  seriesResistance: 60, // ohms
  commutatorHalfGap: 0.06, // radians on either side of theta = k*pi
});

export const MAX_OMEGA = TAU * TURNS_PER_SECOND; // rad/s
export const FLUX_LINKAGE_AMPLITUDE =
  GENERATOR_PARAMETERS.turns *
  GENERATOR_PARAMETERS.magneticFluxDensity *
  GENERATOR_PARAMETERS.coilArea; // weber-turns
export const PEAK_EMF = FLUX_LINKAGE_AMPLITUDE * MAX_OMEGA; // 2.9908 V
export const PEAK_CURRENT =
  (PEAK_EMF - GENERATOR_PARAMETERS.ledForwardVoltage) /
  GENERATOR_PARAMETERS.seriesResistance; // 19.85 mA

function unitSpeed(speed) {
  return Number.isFinite(speed) ? Math.min(1, Math.max(0, speed)) : 0;
}

function rotationDirection(direction) {
  return Number.isFinite(direction) && direction < 0 ? -1 : 1;
}

function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped || 0;
}

/**
 * Coordinates: B points +X. At theta=0 the oriented coil normal points +X;
 * positive rotation is about +Z. Positive coil current follows that normal's
 * right-hand loop orientation. lambda=NBA*cos(theta); e=-d(lambda)/dt.
 *
 * A split ring switches coil leads every half turn; it does not rectify reverse
 * shaft rotation to the same terminal polarity. Red-minus-black terminal EMF
 * is direction*|e| while the contacts are closed. Contact gaps open the circuit
 * near theta=k*pi. With open contacts terminalEmf=0 denotes an unavailable
 * generator source, not a prediction of a floating contact's potential.
 *
 * I=max(0,(Eterminal-Vf)/R) models a forward-only constant-drop LED. Reverse
 * polarity, subthreshold EMF and open contacts all give zero current.
 *
 * Units: fluxLinkage Wb-turn, coilEmf/terminalEmf/terminalVoltage V, current/
 * coilCurrent A, omega rad/s, torque N*m, powers W. terminalEmf is generated
 * source EMF BEFORE the effective R drop; terminalVoltage is across the LED.
 * electricalPower is electromagnetic conversion power, including resistive
 * dissipation. The ideal balance is -torque*omega = ledPower + resistivePower.
 *
 * Compatibility fields flux/emf/output/led are dimensionless. output is only
 * voltage magnitude; use current/normalizedCurrent for visible current flow.
 * Formula reference: https://openstax.org/books/university-physics-volume-2/pages/13-6-electric-generators-and-back-emf
 */
export function sampleInduction(angle, speed, direction = 1) {
  const theta = normalizeAngle(angle);
  const relativeSpeed = unitSpeed(speed);
  const rotationSign = rotationDirection(direction);
  const sine = Math.sin(theta);
  const flux = Math.cos(theta);
  const omega = relativeSpeed * rotationSign * MAX_OMEGA;
  const fluxLinkage = FLUX_LINKAGE_AMPLITUDE * flux;
  const coilEmf = omega === 0 ? 0 : FLUX_LINKAGE_AMPLITUDE * omega * sine;
  const contactClosed =
    Math.abs(sine) > Math.sin(GENERATOR_PARAMETERS.commutatorHalfGap) + 1e-12;
  const commutatorSign = contactClosed ? Math.sign(sine) : 0;
  const terminalEmf =
    contactClosed && omega !== 0 ? commutatorSign * coilEmf : 0;
  const current = contactClosed
    ? Math.max(
        0,
        (terminalEmf - GENERATOR_PARAMETERS.ledForwardVoltage) /
          GENERATOR_PARAMETERS.seriesResistance,
      )
    : 0;
  const coilCurrent = current === 0 ? 0 : commutatorSign * current;
  const normalizedCurrent = Math.min(1, current / PEAK_CURRENT);
  const terminalVoltage = contactClosed
    ? terminalEmf - current * GENERATOR_PARAMETERS.seriesResistance
    : 0;
  const torque =
    coilCurrent === 0 ? 0 : -FLUX_LINKAGE_AMPLITUDE * sine * coilCurrent;
  const mechanicalPower = torque === 0 ? 0 : -torque * omega;
  const electricalPower = current === 0 ? 0 : coilEmf * coilCurrent;
  const resistivePower = current ** 2 * GENERATOR_PARAMETERS.seriesResistance;
  const ledPower = current * GENERATOR_PARAMETERS.ledForwardVoltage;
  return {
    flux,
    emf: coilEmf / PEAK_EMF,
    output: Math.abs(terminalEmf) / PEAK_EMF,
    led: normalizedCurrent,
    fluxLinkage,
    coilEmf,
    terminalEmf,
    terminalVoltage,
    current,
    coilCurrent,
    contactClosed,
    commutatorSign,
    normalizedCurrent,
    omega,
    torque,
    mechanicalPower,
    electricalPower,
    resistivePower,
    ledPower,
  };
}

/** Advance using elapsed seconds, independently of display refresh rate. */
export function advanceAngle(angle, deltaSeconds, speed, direction = 1) {
  const theta = normalizeAngle(angle);
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  // Reduce whole turns first, keeping even very large finite deltas bounded.
  const turns = (elapsed * unitSpeed(speed) * TURNS_PER_SECOND) % 1;
  return normalizeAngle(theta + turns * TAU * rotationDirection(direction));
}
