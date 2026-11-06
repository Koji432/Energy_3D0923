/* Three.js views share one simulation clock; the magnets and housing never rotate. */
const T = window.THREE;
const color = {
  copper: 0xc97a38,
  iron: 0x6a7774,
  red: 0xc97060,
  blue: 0x638caf,
  green: 0x9ac74e,
};
const v = (x, y, z) => new T.Vector3(x, y, z);
const material = (c, options = {}) =>
  new T.MeshStandardMaterial({
    color: new T.Color(c).convertSRGBToLinear(),
    roughness: 0.52,
    metalness: 0.12,
    ...options,
  });
function mesh(geometry, mat, parent, position = [0, 0, 0]) {
  const m = new T.Mesh(geometry, mat);
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, size, pos, mat) {
  return mesh(new T.BoxGeometry(...size), mat, parent, pos);
}
function cylinder(parent, radius, length, pos, mat, segments = 32) {
  const m = mesh(
    new T.CylinderGeometry(radius, radius, length, segments),
    mat,
    parent,
    pos,
  );
  m.rotation.x = Math.PI / 2;
  return m;
}
function tube(parent, points, radius, mat, closed = false) {
  const curve = new T.CatmullRomCurve3(
    points.map((p) => v(...p)),
    closed,
    "centripetal",
  );
  mesh(new T.TubeGeometry(curve, 80, radius, 7, closed), mat, parent);
  return curve;
}
function textSprite(parent, text, pos, textColor = "#fff", scale = 0.5) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "700 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.fillText(text, 96, 51);
  const texture = new T.CanvasTexture(canvas);
  texture.encoding = T.sRGBEncoding;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.position.set(...pos);
  sprite.scale.set(scale * 2, scale, 1);
  parent.add(sprite);
  return sprite;
}
function createMotor() {
  const root = new T.Group(),
    rotor = new T.Group(),
    inside = new T.Group();
  root.add(inside);
  inside.add(rotor);
  const copper = material(color.copper, { metalness: 0.65, roughness: 0.28 });
  const steel = material(0xa1aaa3, { metalness: 0.75, roughness: 0.28 });
  const iron = material(color.iron, { metalness: 0.5 });
  // The coil lies in the YZ plane at theta=0. Its normal then points along the +X magnetic field.
  box(rotor, [0.26, 1.12, 1.43], [0, 0, 0], iron);
  for (let i = 0; i < 13; i++) {
    const x = -0.27 + i * 0.045;
    tube(
      rotor,
      [
        [x, -0.58, -0.83],
        [x, 0.58, -0.83],
        [x, 0.7, -0.66],
        [x, 0.7, 0.66],
        [x, 0.58, 0.83],
        [x, -0.58, 0.83],
        [x, -0.7, 0.66],
        [x, -0.7, -0.66],
      ],
      0.028,
      copper,
      true,
    );
  }
  cylinder(rotor, 0.075, 4.5, [0, 0, 0.22], steel);
  // Two insulated semicircular commutator segments rotate with the coil.
  const commutator = new T.Group();
  commutator.position.z = 1.22;
  commutator.rotation.z = Math.PI / 2;
  rotor.add(commutator);
  for (let i = 0; i < 2; i++) {
    const segment = mesh(
      new T.CylinderGeometry(
        0.22,
        0.22,
        0.4,
        24,
        1,
        false,
        i * Math.PI + 0.06,
        Math.PI - 0.12,
      ),
      copper,
      commutator,
    );
    segment.rotation.x = Math.PI / 2;
  }
  tube(
    rotor,
    [
      [-0.27, 0.58, 0.83],
      [-0.18, 0.4, 1],
      [-0.14, 0, 1.08],
    ],
    0.022,
    copper,
  );
  tube(
    rotor,
    [
      [0.27, -0.58, 0.83],
      [0.18, -0.4, 1],
      [0.14, 0, 1.08],
    ],
    0.022,
    copper,
  );
  const magnets = [];
  for (const [x, c, label] of [
    [-1.13, color.red, "N"],
    [1.13, color.blue, "S"],
  ]) {
    const magnet = new T.Group();
    magnet.position.x = x;
    inside.add(magnet);
    box(magnet, [0.38, 1.9, 2.1], [0, 0, 0], material(c));
    textSprite(magnet, label, [0, 0, 1.08], "#fff", 0.45);
    magnets.push(magnet);
  }
  const brushMat = material(0x3c4944),
    holderMat = material(0x96a399);
  for (const side of [-1, 1]) {
    box(inside, [0.3, 0.18, 0.28], [side * 0.34, 0, 1.24], brushMat);
    box(inside, [0.2, 0.29, 0.42], [side * 0.58, 0, 1.24], holderMat);
    tube(
      inside,
      [
        [side * 0.64, 0, 1.24],
        [side * 0.9, -0.5, 1.4],
        [side * 0.8, -1.03, 1.1],
      ],
      0.035,
      material(side === 1 ? 0xd0745d : 0x44574e),
    );
  }
  const shellMat = material(0xaab8ae, {
    metalness: 0.58,
    roughness: 0.4,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const shell = cylinder(root, 1.49, 2.7, [0, 0, -0.08], shellMat, 64);
  const rings = new T.Group();
  root.add(rings);
  for (const z of [-1.44, 1.28]) {
    mesh(
      new T.TorusGeometry(1.49, 0.026, 8, 72),
      material(0xb2bfb4, { transparent: true, opacity: 0.55 }),
      rings,
      [0, 0, z],
    );
  }
  const back = cylinder(
    root,
    1.49,
    0.12,
    [0, 0, -1.48],
    material(0xc9d3c8, { metalness: 0.4 }),
  );
  const endCap = cylinder(root, 0.31, 0.16, [0, 0, 1.36], material(0xd7dfd3));
  const field = new T.Group();
  inside.add(field);
  // Stationary field arrows go from N (+X direction) to S. They are not emitted waves.
  for (const y of [-0.44, 0.44])
    for (const z of [-0.52, 0.48]) {
      const arrow = new T.ArrowHelper(
        v(1, 0, 0),
        v(-0.89, y, z),
        1.76,
        0x82ae93,
        0.13,
        0.075,
      );
      arrow.line.material.transparent = true;
      arrow.line.material.opacity = 0.6;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = 0.8;
      field.add(arrow);
    }
  return {
    root,
    rotor,
    update(angle, mode, showField) {
      rotor.rotation.z = angle;
      inside.visible = mode !== "closed";
      shellMat.opacity = mode === "closed" ? 1 : 0.09;
      shellMat.depthWrite = mode === "closed";
      shell.position.z = mode === "exploded" ? -3.2 : -0.08;
      back.position.z = mode === "exploded" ? -4.6 : -1.48;
      endCap.position.z = mode === "exploded" ? 2.1 : 1.36;
      endCap.visible = mode !== "cutaway";
      rings.visible = mode !== "exploded";
      magnets.forEach((m, i) => {
        m.position.x = (i === 0 ? -1 : 1) * (mode === "exploded" ? 1.85 : 1.13);
      });
      field.visible = showField && mode !== "closed";
    },
  };
}
function woodMaterial() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e0cca3";
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 100; i++) {
    const x = (i * 73.73) % 256;
    ctx.strokeStyle = i % 3 === 0 ? "#bca27335" : "#f6e8c350";
    ctx.lineWidth = 0.5 + (i % 4) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + Math.sin(i) * 9,
      160,
      x + Math.cos(i) * 12,
      320,
      x + Math.sin(i * 2) * 8,
      512,
    );
    ctx.stroke();
  }
  const map = new T.CanvasTexture(c);
  map.encoding = T.sRGBEncoding;
  return material(0xffffff, { map, roughness: 0.84, metalness: 0 });
}
function createKit(scene) {
  const kit = new T.Group();
  scene.add(kit);
  const wood = woodMaterial(),
    edge = material(0xb19567, { roughness: 0.9, metalness: 0 });
  box(kit, [4.9, 0.15, 3.2], [0, 0.22, 0], edge);
  box(kit, [4.9, 0.08, 3.2], [0, 0.33, 0], wood);
  for (const x of [-1.86, 1.86]) box(kit, [0.2, 0.27, 2.6], [x, 0.08, 0], wood);
  box(kit, [0.92, 5.6, 0.23], [0, 3.12, -0.55], edge);
  box(kit, [0.86, 5.58, 0.05], [0, 3.14, -0.405], wood);
  for (const x of [-2.06, 2.06])
    for (const z of [-1.16, 1.16])
      box(kit, [0.13, 0.016, 0.21], [x, 0.378, z], edge);
  // A pale cable tie emphasizes the connection to the original wooden kit.
  box(kit, [1.02, 0.11, 0.36], [0, 3.2, -0.47], material(0xeeeedd));
  const motor = createMotor();
  motor.root.position.set(0, 5.95, -0.42);
  motor.root.scale.setScalar(0.61);
  kit.add(motor.root);
  cylinder(
    kit,
    0.047,
    0.45,
    [0, 5.95, 1.19],
    material(0x9da79f, { metalness: 0.7 }),
  );
  const propeller = new T.Group();
  propeller.position.set(0, 5.95, 1.37);
  kit.add(propeller);
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-0.16, 0.2);
  bladeShape.bezierCurveTo(-0.72, 0.65, -0.97, 1.5, -0.54, 1.78);
  bladeShape.bezierCurveTo(-0.12, 2.02, 0.7, 1.77, 0.69, 1.36);
  bladeShape.bezierCurveTo(0.65, 0.92, 0.26, 0.57, 0.16, 0.2);
  bladeShape.closePath();
  const bladeGeo = new T.ExtrudeGeometry(bladeShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 2,
    steps: 1,
  });
  const green = material(color.green, { roughness: 0.3, metalness: 0.05 });
  for (let i = 0; i < 4; i++) {
    const blade = mesh(bladeGeo, green, propeller);
    blade.rotation.z = (i * Math.PI) / 2;
  }
  const cap = mesh(
    new T.SphereGeometry(0.39, 32, 20),
    green,
    propeller,
    [0, 0, 0.13],
  );
  cap.scale.z = 0.55;
  const ledMat = material(0xdde5ba, {
    transparent: true,
    opacity: 0.88,
    roughness: 0.18,
    emissive: 0xf3fb86,
    emissiveIntensity: 0,
  });
  const led = new T.Group();
  led.position.set(0, 1.4, 0.07);
  kit.add(led);
  box(led, [0.48, 0.43, 0.25], [0, 0, -0.08], material(0xe5e7d9));
  for (const x of [-0.115, 0.115])
    cylinder(led, 0.023, 0.31, [x, 0, 0.19], material(0xa4aca4));
  cylinder(led, 0.16, 0.35, [0, 0, 0.48], ledMat);
  mesh(new T.SphereGeometry(0.16, 20, 16), ledMat, led, [0, 0, 0.655]);
  const ledLight = new T.PointLight(0xf4ff94, 0, 2);
  ledLight.position.set(0, 0, 0.8);
  led.add(ledLight);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const glowCtx = glowCanvas.getContext("2d"),
    gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(238,255,111,.9)");
  gradient.addColorStop(0.25, "rgba(228,247,91,.45)");
  gradient.addColorStop(1, "rgba(228,247,91,0)");
  glowCtx.fillStyle = gradient;
  glowCtx.fillRect(0, 0, 128, 128);
  const glow = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(glowCanvas),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  glow.position.set(0, 0, 0.71);
  glow.scale.set(1.25, 1.25, 1);
  led.add(glow);
  const redCurve = tube(
    kit,
    [
      [0.488, 5.3217, 0.251],
      [0.77, 4.2, -0.04],
      [1.05, 2.24, 0.04],
      [0.38, 1.32, 0.23],
      [0.115, 1.4, 0.28],
    ],
    0.035,
    material(0xba5f4e),
  );
  const blackCurve = tube(
    kit,
    [
      [-0.115, 1.4, 0.28],
      [-0.5, 1.32, 0.14],
      [-0.82, 2.3, -0.1],
      [-0.6, 4.15, -0.18],
      [-0.488, 5.3217, 0.251],
    ],
    0.035,
    material(0x394b43),
  );
  const particles = [];
  const particleGeo = new T.SphereGeometry(0.065, 8, 6);
  const particleMat = new T.MeshBasicMaterial({ color: 0xd0ab39 });
  for (const curve of [redCurve, blackCurve])
    for (let i = 0; i < 8; i++) {
      const p = mesh(particleGeo, particleMat, kit);
      p.visible = false;
      particles.push({ p, curve, offset: i / 8 });
    }
  // Subtle floor shadow, with transparent scene background so the UI remains light.
  const floor = mesh(
    new T.PlaneGeometry(200, 200),
    new T.ShadowMaterial({ opacity: 0.08 }),
    scene,
    [0, -0.075, 0],
  );
  floor.rotation.x = -Math.PI / 2;
  return {
    motor,
    update(angle, mode, field, ledIntensity, current, progress) {
      propeller.rotation.z = angle;
      motor.update(angle, mode, field);
      ledMat.emissiveIntensity = ledIntensity * 2.4;
      ledLight.intensity = ledIntensity * 0.7;
      glow.material.opacity = ledIntensity * 0.85;
      particles.forEach(({ p, curve, offset }) => {
        p.visible = current > 0.015;
        p.position.copy(curve.getPointAt((progress + offset) % 1));
      });
    },
  };
}
function view(element, position, target, detail = false) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(detail ? 34 : 34, 1, 0.1, 120);
  camera.position.set(...position);
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  if (window.matchMedia("(pointer:coarse)").matches) {
    const hint = element.querySelector(".view-hint");
    if (hint)
      hint.textContent = "2本指で回転・拡大 · 1本指でページをスクロール";
  }
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    detail
      ? "モータの拡大3D模型。固定したN極とS極の間で銅色のコイルが回転します。"
      : "木製スタンドの風力発電装置。緑のプロペラからモータ、導線、LEDへエネルギーが伝わります。",
  );
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    canvas.getAttribute("aria-label") +
      " 矢印キーで視点変更、プラス・マイナスで拡大縮小。",
  );
  // One-finger swipes scroll the lesson; two fingers manipulate the model.
  canvas.style.touchAction = "pan-y";
  for (const type of ["touchstart", "touchmove"])
    canvas.addEventListener(
      type,
      (event) => {
        if (event.touches.length === 1) event.stopImmediatePropagation();
      },
      { capture: true, passive: true },
    );
  element.appendChild(canvas);
  element.querySelector(".scene-loading")?.remove();
  const controls = new T.OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = detail ? 6 : 10;
  controls.maxDistance = detail ? 20 : 29;
  controls.maxPolarAngle = Math.PI * 0.83;
  controls.update();
  controls.saveState();
  controls.touches.TWO = T.TOUCH.DOLLY_ROTATE;
  canvas.addEventListener("keydown", (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const spherical = new T.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    if (event.key === "ArrowLeft") spherical.theta -= 0.12;
    if (event.key === "ArrowRight") spherical.theta += 0.12;
    if (event.key === "ArrowUp") spherical.phi -= 0.12;
    if (event.key === "ArrowDown") spherical.phi += 0.12;
    if (event.key === "+" || event.key === "=") spherical.radius *= 0.9;
    if (event.key === "-") spherical.radius *= 1.1;
    spherical.phi = Math.max(
      0.08,
      Math.min(controls.maxPolarAngle, spherical.phi),
    );
    spherical.radius = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, spherical.radius),
    );
    camera.position
      .copy(controls.target)
      .add(new T.Vector3().setFromSpherical(spherical));
    controls.update();
  });
  scene.add(new T.HemisphereLight(0xffffff, 0xbbc7ad, 0.85));
  const key = new T.DirectionalLight(0xfff7e7, 1.1);
  key.position.set(-4, 9, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.001;
  scene.add(key);
  const fill = new T.DirectionalLight(0xe8f4ff, 0.5);
  fill.position.set(6, 2, -4);
  scene.add(fill);
  let onscreen = true;
  const observer = new IntersectionObserver((entries) => {
    onscreen = entries[0].isIntersecting;
  });
  observer.observe(element);
  const resize = () => {
    const w = element.clientWidth,
      h = element.clientHeight;
    if (w && h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(element);
  resize();
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    element.dispatchEvent(new CustomEvent("scene-error", { bubbles: true }));
  });
  return {
    scene,
    camera,
    controls,
    render() {
      if (onscreen) {
        controls.update();
        renderer.render(scene, camera);
      }
    },
    reset() {
      controls.reset();
    },
  };
}
export function createExperiment() {
  if (!T || !T.OrbitControls)
    throw new Error("3Dライブラリを読み込めませんでした。");
  const overview = view(
    document.getElementById("overview-view"),
    [9, 7.5, 16],
    [0, 3.5, 0],
  );
  const kit = createKit(overview.scene);
  const detail = view(
    document.getElementById("motor-view"),
    [4.3, 2.8, 7.2],
    [0, 0, 0],
    true,
  );
  const motor = createMotor();
  detail.scene.add(motor.root);
  return {
    reset() {
      overview.reset();
      detail.reset();
    },
    update(state, sample, progress) {
      kit.update(
        state.angle,
        state.mode,
        state.field,
        sample.led,
        sample.output,
        progress,
      );
      motor.update(state.angle, state.mode, state.field);
      // Keep exploded parts in frame without changing the user's chosen viewing direction.
      motor.root.scale.setScalar(state.mode === "exploded" ? 0.78 : 1);
      overview.render();
      detail.render();
    },
  };
}
