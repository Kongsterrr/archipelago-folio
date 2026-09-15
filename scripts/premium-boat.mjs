import * as THREE from 'three';

/** Original, texture-free luxury sport runabout. Metres, Y-up, bow at -Z, sea level Y=0.
 * Geometry stays inside the original playable boat's collision/attachment envelope.
 * The cockpit is physically open: the gunwale/deck has a hole and a separate lower sole.
 */
export function createPremiumBoat() {
  const root = new THREE.Group();
  root.name = 'boat';
  const palette = {
    hullIvory: ['#fff5df', .40, .04],
    hullOrange: ['#ef7944', .32, .12],
    navy: ['#254b60', .47, .08],
    upholstery: ['#ffeac9', .78, 0],
    cognac: ['#cc663a', .72, 0],
    teak: ['#c59a67', .68, 0],
    teakSeam: ['#806747', .83, 0],
    satinMetal: ['#bcc9bd', .40, .38],
    rubber: ['#263d46', .78, 0],
    display: ['#163c4b', .24, .05],
    displayLight: ['#a6e5d2', .40, 0],
  };
  const materials = Object.fromEntries(Object.entries(palette).map(([name, [color, roughness, metalness]]) =>
    [name, new THREE.MeshStandardMaterial({ name, color, roughness, metalness })]));
  materials.windshield = new THREE.MeshStandardMaterial({
    name: 'windshield', color: '#77c5ba', roughness: .26, metalness: .02,
    transparent: true, opacity: .66, depthWrite: false, side: THREE.DoubleSide,
  });
  materials.displayLight.emissive.set('#80d8c5');
  materials.displayLight.emissiveIntensity = .22;
  const add = (geometry, mat, pos = [0, 0, 0], rot = [0, 0, 0], parent = root) => {
    const m = new THREE.Mesh(geometry, materials[mat]);
    m.position.set(...pos); m.rotation.set(...rot); m.castShadow = mat !== 'windshield'; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const group = (name, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const g = new THREE.Group(); g.name = name; g.position.set(...pos); g.rotation.set(...rot); root.add(g); return g;
  };
  const box = (w, h, d, x, y, z, mat, rot, parent) => add(new THREE.BoxGeometry(w, h, d), mat, [x, y, z], rot, parent);
  const cylinder = (r1, r2, h, x, y, z, mat, n = 10, rot, parent) => add(new THREE.CylinderGeometry(r1, r2, h, n), mat, [x, y, z], rot, parent);
  const rounded = (w, h, d, x, y, z, mat, r = .025, rot, parent) => {
    r = Math.min(r, w / 3, h / 3, d / 3);
    const a = w / 2 - r, b = h / 2 - r, s = new THREE.Shape();
    s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(-a, b); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -d / 2 + r); return add(g, mat, [x, y, z], rot, parent);
  };
  const rod = (a, b, r, mat, parent = root, n = 6) => {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const m = cylinder(r, r, delta.length(), ...av.clone().add(bv).multiplyScalar(.5).toArray(), mat, n, undefined, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
  };
  const path = (points, radius, mat, parent = root, n = 6) => {
    for (let i = 1; i < points.length; i++) rod(points[i - 1], points[i], radius, mat, parent, n);
  };
  const torus = (r, t, x, y, z, mat, rot, parent, segments = 20) =>
    add(new THREE.TorusGeometry(r, t, 5, segments), mat, [x, y, z], rot, parent);
  const custom = (vs, ix, mat, parent, flat = false) => {
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vs.flat(), 3));
    g.setIndex(ix); if (flat) g = g.toNonIndexed(); g.computeVertexNormals(); return add(g, mat, undefined, undefined, parent);
  };
  const prism = (outline, y0, y1, mat, holes = []) => {
    const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of holes) s.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return add(g, mat);
  };
  // Smooth, tapered planform with a fine bow and a broad transom, without a top cap.
  const outline = [
    [0, -2.00], [.12, -1.89], [.27, -1.72], [.43, -1.48], [.57, -1.19], [.67, -.86],
    [.735, -.50], [.755, -.12], [.750, .33], [.725, .81], [.68, 1.18], [.61, 1.38],
    [.48, 1.42], [-.48, 1.42], [-.61, 1.38], [-.68, 1.18], [-.725, .81], [-.750, .33],
    [-.755, -.12], [-.735, -.50], [-.67, -.86], [-.57, -1.19], [-.43, -1.48], [-.27, -1.72], [-.12, -1.89],
  ];
  const sheer = z => .035 * Math.max(0, -z - .4);
  const ring = (scale, height, zScale = 1) => outline.map(([x, z]) => [x * scale, height + sheer(z), (z - .18) * zScale + .18]);
  const loft = (rings, mat, inward = false) => {
    const n = rings[0].length, vs = rings.flat(), ix = [];
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n, c = a + n, d = b + n; ix.push(...(inward ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
    }
    return custom(vs, ix, mat);
  };
  loft([ring(.53, .115, .88), ring(.79, .285, .963)], 'navy');
  loft([ring(.79, .285, .963), ring(.925, .47, .990), ring(.990, .715)], 'hullOrange');
  loft([ring(.990, .715), ring(1.002, .760)], 'navy');
  loft([ring(1.002, .760), ring(1, .805)], 'hullIvory');
  // Underbody closure is below the cockpit, so it never creates a false deck.
  prism(outline.map(([x, z]) => [x * .53, (z - .18) * .88 + .18]), .107, .117, 'navy');
  const cockpit = [[-.53, -.71], [-.587, -.48], [-.60, .75], [-.54, 1.15], [.54, 1.15], [.60, .75], [.587, -.48], [.53, -.71]];
  prism(outline, .800, .848, 'hullIvory', [cockpit]);
  // Satin rub rail traces the hull's sheer; raised bow resolves the top into a sharp nose.
  path([...outline, outline[0]].map(([x, z]) => [x * 1.003, .799 + sheer(z) * .55, z]), .012, 'satinMetal');
  // Continuous cockpit walls and a visibly lower teak sole.
  const well = cockpit.map(([x, z]) => [x * .97, z]);
  loft([cockpit.map(([x, z]) => [x, .80, z]), well.map(([x, z]) => [x, .525, z])], 'hullIvory', true);
  prism(well, .518, .537, 'teak');
  for (let x = -.48; x <= .481; x += .12) box(.009, .004, 1.67, x, .540, .22, 'teakSeam');
  for (const z of [-.59, .58, 1.03]) box(1.02, .004, .010, 0, .540, z, 'teakSeam');
  // Inset bow teak panel, cut to the narrowing hull, with individual dark caulk seams.
  const bowDeck = [[0, -1.85], [.19, -1.65], [.37, -1.33], [.47, -1.02], [.43, -.83], [-.43, -.83], [-.47, -1.02], [-.37, -1.33], [-.19, -1.65]];
  prism(bowDeck, .849, .863, 'teak');
  path([...bowDeck, bowDeck[0]].map(([x, z]) => [x, .865, z]), .005, 'teakSeam', root, 4);
  for (const x of [-.36, -.24, -.12, 0, .12, .24, .36]) {
    const start = -1.83 + Math.abs(x) * 1.47; box(.008, .003, -.865 - start, x, .866, (start - .865) / 2, 'teakSeam');
  }
  // Small bow hatch with a recessed pull and a single clean central cream spine.
  rounded(.24, .024, .28, 0, .884, -1.18, 'hullIvory', .012);
  rounded(.065, .007, .025, 0, .899, -1.10, 'satinMetal', .003);
  // Side bolsters and capped gunwales emphasize the depth of the open cockpit.
  for (const s of [-1, 1]) {
    rounded(.072, .13, 1.45, s * .602, .800, .25, 'cognac', .021);
    path([[s * .601, .855, -.41], [s * .616, .855, .63], [s * .571, .855, 1.08]], .008, 'upholstery');
    // Teak side step near the aft bench, with two fine caulk lines.
    box(.12, .012, .33, s * .641, .855, .95, 'teak');
    for (const dx of [-.024, .024]) box(.007, .003, .315, s * .641 + dx, .863, .95, 'teakSeam');
  }
  // Plush bucket seats: structural shell, pedestal, seat pad, rolled bolsters, quilt and piping.
  const roundedLoop = (w, h, y, z, mat, parent) => {
    const r = .025, x = w / 2, a = h / 2;
    path([[-x + r, y - a, z], [x - r, y - a, z], [x, y - a + r, z], [x, y + a - r, z], [x - r, y + a, z], [-x + r, y + a, z], [-x, y + a - r, z], [-x, y - a + r, z], [-x + r, y - a, z]], .006, mat, parent, 5);
  };
  for (const x of [-.292, .292]) {
    const seat = group(x < 0 ? 'port_captain_seat' : 'starboard_helm_seat', [x, 0, .06]);
    cylinder(.067, .10, .13, 0, .602, .03, 'satinMetal', 10, undefined, seat);
    rounded(.44, .10, .42, 0, .710, .01, 'navy', .027, undefined, seat);
    rounded(.403, .126, .377, 0, .782, -.013, 'upholstery', .038, undefined, seat);
    rounded(.44, .372, .105, 0, .955, .193, 'hullOrange', .029, [-.10, 0, 0], seat);
    rounded(.322, .306, .086, 0, .965, .132, 'upholstery', .025, [-.10, 0, 0], seat);
    // Aft-facing upholstery and a grab rail stay visible from the normal chase camera.
    const aftPanel = new THREE.Group(); aftPanel.name = 'aft_upholstery';
    aftPanel.position.set(0, .980, .253); aftPanel.rotation.x = -.10; seat.add(aftPanel);
    rounded(.314, .203, .025, 0, 0, 0, 'upholstery', .008, undefined, aftPanel);
    roundedLoop(.287, .175, 0, .016, 'cognac', aftPanel);
    for (const sx of [-.067, .067]) box(.004, .139, .003, sx, 0, .018, 'cognac', undefined, aftPanel);
    path([[-.12, .839, .252], [-.12, .839, .287], [.12, .839, .287], [.12, .839, .252]], .008, 'satinMetal', seat);
    rod([-.069, .839, .288], [.069, .839, .288], .010, 'navy', seat);
    for (const sx of [-.178, .178]) {
      rounded(.073, .278, .151, sx, .951, .101, 'cognac', .026, [-.12, 0, 0], seat);
      rounded(.051, .074, .27, sx, .855, -.023, 'cognac', .017, undefined, seat);
    }
    const quilt = new THREE.Group(); quilt.name = 'front_diamond_stitching';
    quilt.position.set(0, .965, .084); quilt.rotation.x = -.10; seat.add(quilt);
    roundedLoop(.30, .266, .003, 0, 'cognac', quilt);
    // Diamond stitching is actual narrow geometry, offset just in front of the upholstered face.
    for (const cx of [-.10, 0, .10]) for (const cy of [.884, .984, 1.084]) {
      const hw = .046, hh = .043;
      path([[cx, cy - .965 - hh, -.002], [cx + hw, cy - .965, -.002], [cx, cy - .965 + hh, -.002], [cx - hw, cy - .965, -.002], [cx, cy - .965 - hh, -.002]], .0023, 'cognac', quilt, 4);
    }
    path([[-.155, .837, -.168], [.155, .837, -.168]], .006, 'cognac', seat, 5);
    for (const sx of [-.095, .095]) box(.004, .004, .245, sx, .847, -.014, 'cognac', undefined, seat);
    rounded(.155, .016, .026, 0, 1.105, .075, 'navy', .004, undefined, seat);
  }
  // Three-person aft lounge with split cushions, thick backs and visible stitching.
  rounded(1.065, .15, .385, 0, .667, .919, 'navy', .028);
  rounded(1.11, .355, .14, 0, .903, 1.16, 'hullOrange', .034, [-.06, 0, 0]);
  for (const x of [-.346, 0, .346]) {
    rounded(.329, .133, .339, x, .786, .912, 'upholstery', .030);
    rounded(.325, .255, .089, x, .926, 1.075, 'upholstery', .024, [-.06, 0, 0]);
    path([[x - .135, .843, .770], [x + .135, .843, .770]], .006, 'cognac', root, 5);
    for (const dx of [-.078, 0, .078]) rod([x + dx, .824, 1.024], [x + dx, 1.020, 1.016], .003, 'cognac', root, 4);
  }
  path([[-.51, 1.063, 1.049], [.51, 1.063, 1.049]], .009, 'cognac');
  // Sloping helm console: two display bezels, tactile controls, leather wheel, and throttle.
  custom([[-.542, .736, -.70], [.542, .736, -.70], [-.542, .736, -.385], [.542, .736, -.385], [-.525, 1.018, -.64], [.525, 1.018, -.64], [-.525, .895, -.385], [.525, .895, -.385]],
    [0, 1, 4, 1, 5, 4, 4, 5, 6, 5, 7, 6, 6, 7, 2, 7, 3, 2, 0, 4, 2, 4, 6, 2, 1, 3, 5, 3, 7, 5, 0, 2, 1, 1, 2, 3], 'hullIvory', root, true);
  const dash = group('premium_helm', [0, .974, -.490], [-.61, 0, 0]);
  rounded(1.005, .148, .025, 0, 0, 0, 'navy', .01, undefined, dash);
  for (const [x, w] of [[.275, .292], [-.235, .235]]) {
    rounded(w, .113, .018, x, .001, .017, 'rubber', .007, undefined, dash);
    box(w - .028, .086, .005, x, .002, .029, 'display', undefined, dash);
    // Navigation contour and readable instrument bars without texture dependencies.
    path([[x - w * .36, -.023, .032], [x - w * .19, .018, .032], [x, -.007, .032], [x + w * .13, .025, .032], [x + w * .35, .025, .032]], .0028, 'displayLight', dash, 4);
    for (let i = 0; i < 3; i++) box(.016, .007, .003, x - w * .30 + i * .024, .030, .033, 'displayLight', undefined, dash);
  }
  for (const x of [-.045, .025]) {
    cylinder(.024, .024, .01, x, -.004, .025, 'satinMetal', 10, [Math.PI / 2, 0, 0], dash);
    cylinder(.016, .016, .012, x, -.004, .033, 'display', 10, [Math.PI / 2, 0, 0], dash);
    const needle=new THREE.Group();needle.name=x<0?'anim_gauge_0':'anim_gauge_1';needle.position.set(x,-.004,.041);dash.add(needle);rod([0,0,0],[.009,.009,0],.0025,'displayLight',needle,4);
  }
  const wheel = group('anim_helm', [.290, .940, -.259], [-.53, 0, 0]);
  cylinder(.033, .04, .095, 0, 0, -.05, 'navy', 10, [Math.PI / 2, 0, 0], wheel);
  torus(.108, .015, 0, 0, 0, 'rubber', undefined, wheel, 22);
  torus(.104, .0035, 0, 0, .013, 'cognac', undefined, wheel, 22);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 2;
    rod([0, 0, .002], [Math.cos(a) * .095, Math.sin(a) * .095, .002], .008, 'satinMetal', wheel);
  }
  cylinder(.032, .032, .02, 0, 0, .012, 'hullIvory', 12, [Math.PI / 2, 0, 0], wheel);
  cylinder(.013, .013, .023, 0, 0, .025, 'hullOrange', 10, [Math.PI / 2, 0, 0], wheel);
  rounded(.089, .048, .178, .53, .841, -.202, 'satinMetal', .014);
  rounded(.055, .012, .102, .53, .869, -.202, 'rubber', .004);
  rod([.530, .872, -.193], [.530, .987, -.235], .011, 'satinMetal');
  rounded(.071, .029, .047, .530, .998, -.238, 'rubber', .009);
  // Eight lightly faceted teal panes wrap naturally around the console, below the seated eye line.
  const glassBase = [[-.633, .862, -.23], [-.634, .868, -.48], [-.556, .884, -.73], [-.34, .901, -.89], [0, .906, -.948], [.34, .901, -.89], [.556, .884, -.73], [.634, .868, -.48], [.633, .862, -.23]];
  const glassTop = [[-.626, 1.02, -.25], [-.596, 1.17, -.50], [-.49, 1.29, -.805], [-.30, 1.338, -.995], [0, 1.35, -1.045], [.30, 1.338, -.995], [.49, 1.29, -.805], [.596, 1.17, -.50], [.626, 1.02, -.25]];
  const gv = [], gi = [];
  for (let i = 0; i < glassBase.length; i++) gv.push(glassBase[i], glassTop[i]);
  for (let i = 0; i < glassBase.length - 1; i++) { const a = i * 2; gi.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  custom(gv, gi, 'windshield');
  path(glassBase, .012, 'navy'); path(glassTop, .012, 'satinMetal');
  for (const i of [0, 2, 4, 6, 8]) rod(glassBase[i], glassTop[i], i === 4 ? .007 : .010, 'satinMetal');
  // A single slim wiper across the centre pane is legible from the chase camera.
  rod([.05, .930, -.958], [.176, 1.16, -.998], .005, 'rubber');
  rod([.108, 1.058, -.982], [.23, 1.238, -1.016], .0055, 'rubber');
  // Bow grab rails and four flush deck cleats: modest satin reflection works without an environment map.
  for (const s of [-1, 1]) {
    const rp = [[s * .224, .914, -1.68], [s * .30, .976, -1.50], [s * .46, .973, -1.19]];
    path(rp, .010, 'satinMetal');
    rod([s * .224, .86, -1.68], rp[0], .011, 'satinMetal');
    rod([s * .46, .859, -1.19], rp[2], .011, 'satinMetal');
    for (const [cx, z] of [[.59, -.90], [.643, 1.09]]) {
      rounded(.115, .014, .064, s * cx, .858, z, 'satinMetal', .004);
      for (const dz of [-.020, .020]) cylinder(.010, .010, .035, s * cx, .880, z + dz, 'satinMetal', 6);
      rod([s * cx, .900, z - .059], [s * cx, .900, z + .059], .010, 'satinMetal');
    }
    // Circular cup recesses and inset speakers sit on the interior sides.
    for (const z of [.49, .93]) {
      cylinder(.038, .038, .014, s * .634, .867, z, 'rubber', 12);
      torus(.039, .006, s * .634, .875, z, 'satinMetal', [Math.PI / 2, 0, 0], root, 14);
    }
    const speaker = group(s < 0 ? 'port_audio' : 'starboard_audio', [s * .591, .659, .37], [0, s * Math.PI / 2, 0]);
    cylinder(.057, .057, .014, 0, 0, 0, 'satinMetal', 14, [Math.PI / 2, 0, 0], speaker);
    cylinder(.046, .046, .017, 0, 0, .006, 'rubber', 12, [Math.PI / 2, 0, 0], speaker);
    for (const yy of [-.024, -.008, .008, .024]) box(.067, .0035, .003, 0, yy, .017, 'satinMetal', undefined, speaker);
    // Minimal navigation lenses on port/starboard deck edges.
    rounded(.042, .022, .092, s * .690, .854, -.58, 'navy', .007);
    box(.044, .013, .050, s * .693, .866, -.58, s < 0 ? 'hullOrange' : 'displayLight');
  }
  torus(.036, .009, 0, .662, -1.967, 'satinMetal', undefined, root, 12);
  // Twin teak swim platforms wrap around a compact sculpted outboard, with a recessed ladder.
  for (const s of [-1, 1]) {
    rounded(.36, .075, .365, s * .44, .661, 1.493, 'hullIvory', .026);
    rounded(.305, .012, .30, s * .44, .706, 1.488, 'teak', .004);
    for (const dx of [-.09, 0, .09]) box(.008, .003, .274, s * .44 + dx, .714, 1.488, 'teakSeam');
  }
  for (const x of [-.54, -.36]) rod([x, .692, 1.59], [x, .585, 1.72], .010, 'satinMetal');
  for (const z of [1.61, 1.685]) rod([-.54, .627, z], [-.36, .627, z], .010, 'satinMetal');
  const engineStart=root.children.length;
  rounded(.39, .44, .40, 0, .633, 1.606, 'navy', .078, [-.07, 0, 0]);
  rounded(.347, .078, .335, 0, .851, 1.582, 'hullOrange', .025, [-.07, 0, 0]);
  rounded(.275, .052, .018, 0, .735, 1.813, 'hullIvory', .011);
  // Small applied shield and monogram give the motor a crafted, bespoke finish.
  custom([[-.029, .752, 1.829], [.029, .752, 1.829], [.025, .725, 1.829], [0, .714, 1.829], [-.025, .725, 1.829]], [0, 4, 1, 1, 4, 2, 2, 4, 3], 'navy');
  box(.026, .0045, .003, 0, .744, 1.831, 'hullOrange');
  path([[.006, .743, 1.833], [.006, .725, 1.833], [-.006, .725, 1.833], [-.010, .729, 1.833]], .0025, 'upholstery', root, 4);
  for (const y of [.562, .612, .662]) rounded(.257, .017, .013, 0, y, 1.816, 'satinMetal', .004);
  for (const s of [-1, 1]) for (const z of [1.51, 1.57, 1.63, 1.69]) box(.011, .11, .019, s * .193, .715, z, 'rubber', [.0, .0, -.15 * s]);
  rounded(.205, .18, .196, 0, .376, 1.691, 'satinMetal', .032, [-.12, 0, 0]);
  rounded(.38, .028, .25, 0, .321, 1.692, 'navy', .009);
  rounded(.075, .100, .14, 0, .250, 1.731, 'navy', .020, [-.10, 0, 0]);
  cylinder(.060, .037, .177, 0, .306, 1.822, 'satinMetal', 12, [Math.PI / 2, 0, 0]);
  // Three swept propeller blades, contained within the original submerged envelope.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + .35, c = Math.cos(a), s = Math.sin(a);
    const p = (r, t, z) => [c * r - s * t, .306 + s * r + c * t, z];
    custom([p(.03, -.015, 1.903), p(.135, -.031, 1.898), p(.118, .038, 1.925), p(.033, .023, 1.915)], [0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0], 'satinMetal');
  }
  const engineParts=root.children.slice(engineStart);const motor=group('anim_engine',[0,0,1.42]);root.updateMatrixWorld(true);for(const part of engineParts)motor.attach(part);
  // A short stern pennant preserves the playful identity without introducing a roof-like silhouette.
  rod([-.567, .856, 1.224], [-.567, 1.504, 1.31], .009, 'satinMetal');
  cylinder(.017, .017, .019, -.567, 1.511, 1.311, 'hullIvory', 8);
  custom([[-.565, 1.484, 1.311], [-.220, 1.410, 1.341], [-.314, 1.275, 1.326], [-.565, 1.301, 1.286]], [0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0], 'hullOrange');
  path([[-.535, 1.461, 1.315], [-.273, 1.407, 1.339]], .009, 'upholstery', root, 4);
  // Original stroke lettering, merged into existing material batches.
  const alphabet={J:[[[0,1],[1,1]],[[.7,1],[.7,0],[.2,0],[0,.2]]],A:[[[0,0],[.5,1],[1,0]],[[.2,.4],[.8,.4]]],C:[[[1,1],[0,1],[0,0],[1,0]]],K:[[[0,0],[0,1]],[[1,1],[0,.5],[1,0]]],'0':[[[0,0],[0,1],[1,1],[1,0],[0,0]]],'1':[[[.25,.8],[.6,1],[.6,0]]], ' ':[]};
  for(const side of [-1,1]){const plate=group('jack_01_nameplate',[side*.708,.66,.69],[0,side*Math.PI/2,0]);rounded(.44,.106,.012,0,0,0,'navy',.014,undefined,plate);[...'JACK 01'].forEach((letter,i)=>{for(const stroke of alphabet[letter])path(stroke.map(([x,y])=>[-.195+i*.056+x*.034,-.033+y*.065,.010]),.0028,'hullIvory',plate,4);});}
  root.userData = {
    originalProceduralAsset: true, author: 'Jack portfolio original premium boat builder',
    forward: '-Z', seaLevel: 0, design: 'Jack 01 open-cockpit luxury sport runabout, three signature finishes',
    materialNames: Object.keys(materials),
  };
  // Keep the detailed silhouette inside the established portrait camera framing.
  root.scale.setScalar(.97);
  root.position.y=-.76;
  // Each moving assembly uses one vertex-colored material batch.
  const moving=new THREE.MeshStandardMaterial({name:'movingHardware',vertexColors:true,roughness:.43,metalness:.18});
  root.traverse(node=>{if(node.name.startsWith('anim_'))node.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();const color=o.material.color,a=new Float32Array(o.geometry.getAttribute('position').count*3);for(let n=0;n<a.length;n+=3){a[n]=color.r;a[n+1]=color.g;a[n+2]=color.b;}o.geometry.setAttribute('color',new THREE.BufferAttribute(a,3));o.material=moving;}});});
  return root;
}
