import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original toy-bay fauna. Metres, +Y up, -Z forward; origin at body centre.
 * Each animal has one opaque vertex-color material and 3–4 merged mesh batches.
 * Named groups are animation pivots: tail rotate x (dolphin), y (shark/fish),
 * flippers rotate z; seagull's flippers are its curved wings (rotate z).
 * Source geometry and compressed GLBs have the same hierarchy.
 */
export const ANIMAL_SPECS = Object.freeze({
  dolphin: { length: 2.4, triangleBudget: 1200 },
  shark: { length: 3.2, triangleBudget: 1200 },
  turtle: { length: 1.2, triangleBudget: 1000 },
  tropicalfish: { length: .45, triangleBudget: 150 },
  seagull: { wingspan: .7, triangleBudget: 250 },
});

const V = (p) => new THREE.Vector3(...p);
const color = (hex) => new THREE.Color(hex);
const palettes = {
  dolphin: ['#609eac', '#d5e8d9', '#86c4cc', '#173e52'],
  shark: ['#507b90', '#e2e4d4', '#91adb4', '#1c3847'],
  turtle: ['#497e68', '#92a971', '#a6bc7a', '#203e3b'],
  tropicalfish: ['#f7ae42', '#fff1b0', '#ee7755', '#24556b'],
  seagull: ['#f9f1df', '#bacad0', '#edac55', '#294653'],
};

function paint(geometry, hex) {
  const c = color(hex), n = geometry.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(a, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}

function part(parent, geometry, hex) {
  if (hex) paint(geometry, hex);
  const m = new THREE.Mesh(geometry);
  parent.add(m);
  return m;
}

function ellipsoid(parent, centre, radius, hex, segments = 8, rings = 5) {
  const g = new THREE.SphereGeometry(1, segments, rings);
  g.scale(...radius).translate(...centre);
  return part(parent, g, hex);
}

// Smooth ring loft, including non-circular sections and a curved spine.
function body(parent, rows, segments, dorsal, ventral) {
  const positions = [], colors = [], indices = [], up = color(dorsal), down = color(ventral);
  for (let j = 0; j < rows.length; j++) {
    const [z, y, rx, ry] = rows[j];
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      positions.push(s * rx, y + c * ry, z);
      const blend = THREE.MathUtils.smoothstep(-c, .1, .78);
      const shade = 1 - .04 * Math.abs(s);
      const col = up.clone().lerp(down, blend).multiplyScalar(shade);
      colors.push(col.r, col.g, col.b);
      if (j < rows.length - 1) {
        const a = j * segments + i, b = j * segments + (i + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  }
  // Close ring ends with centre vertices; do not leave exposed cuts.
  for (const [j, flip] of [[0, false], [rows.length - 1, true]]) {
    const [z, y] = rows[j], index = positions.length / 3;
    positions.push(0, y, z); colors.push(up.r, up.g, up.b);
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i, b = j * segments + (i + 1) % segments;
      indices.push(index, flip ? b : a, flip ? a : b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return part(parent, g);
}

// Rounded, closed polygon. Each face has a small raised ridge, not a flat card.
function fin(parent, outline, normal, thickness, hex, underside = hex, centreOverride = null) {
  const average = outline.reduce((s, p) => s.add(V(p)), new THREE.Vector3()).multiplyScalar(1 / outline.length);
  const centre = centreOverride ? V(centreOverride) : average;
  const n = V(normal).normalize(), vertices = [], colors = [], indices = [];
  // Mirror-safe outward winding: both left and right flippers face the light.
  const area = new THREE.Vector3();
  for(let i=0;i<outline.length;i++) area.add(V(outline[i]).sub(average).cross(V(outline[(i+1)%outline.length]).sub(average)));
  if(area.dot(n)<0)outline=[...outline].reverse();
  const top = color(hex), bottom = color(underside), count = outline.length;
  for (const side of [1, -1]) {
    const c = side === 1 ? top : bottom;
    for (const p of outline) {
      const q = V(p).addScaledVector(n, thickness * side * .18);
      vertices.push(q.x, q.y, q.z); colors.push(c.r, c.g, c.b);
    }
    const q = centre.clone().addScaledVector(n, thickness * side * .5);
    vertices.push(q.x, q.y, q.z); colors.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count, a = i, b = next, c = count + 1 + i, d = count + 1 + next;
    indices.push(count, a, b, count * 2 + 1, d, c, a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return part(parent, g);
}

function tube(parent, points, radius, hex, radialSegments = 4) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  return part(parent, new THREE.TubeGeometry(curve, points.length * 2, radius, radialSegments, false), hex);
}

function pivot(root, name, pos) {
  const g = new THREE.Group(); g.name = name; g.position.set(...pos); root.add(g); return g;
}

function eyes(root, pos, radius, dark, low) {
  for (const side of [-1, 1]) {
    ellipsoid(root, [pos[0] * side, pos[1], pos[2]], [radius * .42, radius, radius * .9], dark, low ? 4 : 6, 3);
  }
}

function dolphin(root, low, p) {
  const segments = low ? 10 : 14;
  body(root, [
    [-1.2,.025,.012,.017],[-1.13,.04,.07,.052],[-.88,.055,.10,.065],
    [-.79,.135,.16,.175],[-.62,.14,.225,.235],[-.32,.1,.27,.28],
    [.04,.055,.25,.26],[.36,.01,.195,.205],[.66,-.005,.105,.12],
    [.9,.005,.046,.065],[1,.015,.025,.039],
  ], segments, p[0], p[1]);
  // A crescent dorsal fin, soft shoulders and a slim curved rostrum.
  fin(root, [[0,.25,-.18],[0,.38,-.07],[0,.66,.17],[0,.64,.23],[0,.36,.19],[0,.22,.4]], [1,0,0], .08, p[0],p[2]);
  eyes(root, [.169,.20,-.758], .032, p[3], low);
  if (!low) for(const s of [-1,1]) tube(root, [[s*.075,.015,-1.1],[s*.097,.003,-.88],[s*.16,.025,-.73]], .006, p[3],3);
  // Blowhole follows the curved forehead instead of sitting on a stalk.
  ellipsoid(root, [0,.374,-.47], [.035,.006,.027], p[3], 6, 3);
  for (const side of [-1,1]) {
    const flipper = pivot(root, side < 0 ? 'anim_flipper_L' : 'anim_flipper_R', [side*.19,-.075,-.32]);
    fin(flipper, [[0,0,-.08],[side*.15,-.025,.005],[side*.37,-.13,.3],[side*.34,-.16,.35],[side*.15,-.08,.27],[0,0,.14]], [0,1,0], .045, p[0],p[1]);
  }
  const tail = pivot(root,'anim_tail',[0,.015,.88]);
  for (const side of [-1,1]) fin(tail, [[0,0,0],[side*.17,.025,.02],[side*.42,.075,.18],[side*.41,.065,.25],[side*.12,0,.27],[0,-.005,.19]], [0,1,0], .043, p[0],p[1]);
  root.userData.animation = {tailAxis:'x', flipperAxis:'z'};
}

function shark(root, low, p) {
  body(root, [
    [-1.6,-.045,.018,.022],[-1.45,.005,.14,.095],[-1.16,.055,.26,.185],
    [-.83,.075,.325,.28],[-.42,.04,.33,.30],[0,0,.285,.27],
    [.38,-.015,.215,.19],[.72,-.005,.115,.105],[1.06,.035,.039,.062],
  ], low ? 10 : 14, p[0],p[1]);
  fin(root, [[0,.25,-.55],[0,.52,-.38],[0,.93,-.1],[0,.88,-.015],[0,.33,.05],[0,.225,.2]], [1,0,0], .095,p[0],p[2]);
  fin(root, [[0,.1,.65],[0,.33,.69],[0,.3,.75],[0,.08,.91]], [1,0,0], .035,p[0]);
  for (const s of [-1,1]) {
    fin(root, [[s*.12,-.15,.23],[s*.28,-.24,.48],[s*.22,-.22,.58],[s*.09,-.1,.47]], [0,1,0], .04,p[0],p[1]);
    // Three narrow inset-looking gill slashes per side.
    for (let i=0;i<3;i++) {
      const z=-.72+i*.105, x=s*(.329 - i*.002);
      fin(root,[[x,.03,z],[x,.13,z+.035],[x,.09,z+.05],[x,-.075,z+.017]], [s,0,0],.003,p[3]);
    }
    if(!low) tube(root,[[s*.1,-.063,-1.4],[s*.21,-.09,-1.17],[s*.257,-.055,-1.01]],.006,p[3],3);
    const flipper=pivot(root,s<0?'anim_flipper_L':'anim_flipper_R',[s*.255,-.085,-.53]);
    fin(flipper,[[0,0,-.08],[s*.3,-.09,.10],[s*.65,-.26,.48],[s*.61,-.27,.55],[s*.27,-.1,.34],[0,0,.15]],[0,1,0],.055,p[0],p[1]);
  }
  eyes(root,[.231,.13,-1.15],.035,p[3],low);
  const tail=pivot(root,'anim_tail',[0,.035,1.0]);
  body(tail,[[0,0,.044,.065],[.19,.015,.025,.055]],6,p[0],p[1]);
  // The long upper lobe and shorter lower lobe make the shark recognizable.
  fin(tail,[[0,0,0],[0,.21,.12],[0,.63,.54],[0,.66,.6],[0,.28,.42],[0,.055,.27]],[1,0,0],.05,p[0],p[2]);
  fin(tail,[[0,.045,.08],[0,-.25,.39],[0,-.37,.49],[0,-.36,.56],[0,-.1,.37],[0,.055,.27]],[1,0,0],.04,p[0],p[1]);
  root.userData.animation={tailAxis:'y',flipperAxis:'z'};
}

function turtle(root, low, p) {
  ellipsoid(root,[0,0,.025],[.36,.17,.435],p[1],low?10:14,low?5:7);
  ellipsoid(root,[0,.055,.025],[.345,.23,.42],p[0],low?10:14,low?5:7);
  // Nine raised, separated scutes following an ellipsoidal carapace.
  const surface=(x,z)=>.059+.234*Math.sqrt(Math.max(.06,1-(x/.353)**2-((z-.025)/.439)**2));
  const scute=(points,hex)=>{
    const x=points.reduce((s,p)=>s+p[0],0)/points.length,z=points.reduce((s,p)=>s+p[1],0)/points.length;
    fin(root,points.map(([x,z])=>[x,surface(x,z),z]),[0,1,0],.008,hex,hex,[x,surface(x,z)+.006,z]);
  };
  for(let row=0;row<3;row++){
    const z=-.23+row*.245;
    scute([[-.105,z-.10],[.105,z-.10],[.155,z],[.097,z+.109],[-.097,z+.109],[-.155,z]],row===1?'#63966d':'#699c71');
  }
  for(const s of [-1,1]) for(let row=0;row<3;row++){
    const z=-.23+row*.245, inner=.158, outer=row===1?.328:.269;
    scute([[s*inner,z-.096],[s*(outer-.031),z-.077],[s*outer,z+.017],[s*(outer-.047),z+.097],[s*inner,z+.109],[s*(inner+.04),z]],row===1?'#749d6e':'#5f8e65');
  }
  body(root,[[-.545,.025,.059,.061],[-.35,.015,.073,.065]],8,p[2],p[1]);
  ellipsoid(root,[0,.04,-.49],[.101,.084,.129],p[2],low?6:8,4);
  eyes(root,[.089,.08,-.535],.021,p[3],true);
  for (const s of [-1,1]) {
    const flipper=pivot(root,s<0?'anim_flipper_L':'anim_flipper_R',[s*.265,-.024,-.24]);
    fin(flipper,[[0,0,-.035],[s*.16,.014,-.075],[s*.38,-.02,.05],[s*.42,-.06,.13],[s*.32,-.08,.17],[s*.105,-.035,.11],[0,0,.08]],[0,1,0],.035,p[2],p[1]);
    fin(root,[[s*.23,-.055,.29],[s*.41,-.07,.37],[s*.47,-.085,.49],[s*.38,-.09,.53],[s*.25,-.065,.41]],[0,1,0],.03,p[2],p[1]);
  }
  const tail=pivot(root,'anim_tail',[0,-.028,.39]);
  fin(tail,[[-.035,0,0],[0,-.015,.19],[.035,0,0]],[0,1,0],.026,p[2]);
  root.userData.animation={tailAxis:'y',flipperAxis:'z'};
}

function tropicalfish(root, low, p) {
  body(root,[[-.225,0,.004,.009],[-.177,.004,.045,.075],[-.09,0,.063,.105],[.035,0,.035,.07],[.12,0,.009,.017]],6,p[0],p[1]);
  // Crown and anal fins follow the body profile and add coral edges.
  fin(root,[[0,.064,-.14],[0,.15,-.065],[0,.147,-.01],[0,.052,.065]],[1,0,0],.012,p[2]);
  fin(root,[[0,-.065,-.12],[0,-.124,-.033],[0,-.11,.009],[0,-.04,.071]],[1,0,0],.009,p[2]);
  // Flat diamond eyes are deliberately economical for a school of fish.
  for(const s of [-1,1]) {
    const x=.043*s;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([x,.037,-.175,x,.021,-.19,x,.005,-.175,x,.021,-.159],3));
    g.setIndex(s===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();part(root,g,p[3]);
    // A slender turquoise shoulder bar; color shape follows body surface.
    const strip=new THREE.BufferGeometry();
    strip.setAttribute('position',new THREE.Float32BufferAttribute([s*.041,.059,-.147,s*.053,.048,-.13,s*.054,-.041,-.13,s*.041,-.054,-.147],3));
    strip.setIndex(s===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);strip.computeVertexNormals();part(root,strip,p[3]);
  }
  const tail=pivot(root,'anim_tail',[0,0,.108]);
  fin(tail,[[0,0,0],[0,.084,.114],[0,.012,.10],[0,-.012,.10],[0,-.084,.114]],[1,0,0],.014,p[2],p[0]);
  root.userData.animation={tailAxis:'y'};
}

function seagull(root, low, p) {
  body(root,[[-.137,.025,.012,.018],[-.106,.035,.036,.04],[-.057,.007,.043,.059],[.025,0,.042,.043],[.09,.008,.024,.022]],6,p[0],p[0]);
  ellipsoid(root,[0,.048,-.106],[.038,.038,.04],p[0],6,3);
  fin(root,[[-.014,.034,-.139],[0,.025,-.188],[.014,.034,-.139],[0,.052,-.137]],[0,1,0],.014,p[2]);
  // Swept, upward-curving wings. Each cross-section is a shallow solid wedge.
  for(const s of [-1,1]){
    const wing=pivot(root,s<0?'anim_flipper_L':'anim_flipper_R',[s*.023,.015,-.018]);
    fin(wing,[[0,0,-.026],[s*.09,.031,-.054],[s*.181,.04,-.019],[s*.271,.012,.031],[s*.327,-.007,.092],[s*.255,.002,.075],[s*.177,.009,.049],[s*.073,.01,.061],[0,0,.043]],[0,1,0],.018,p[0],p[1]);
    // Dark primary feathers are baked into the wing batch and move with it.
    fin(wing,[[s*.231,.02,.015],[s*.271,.016,.031],[s*.327,-.003,.092],[s*.255,.006,.075],[s*.212,.014,.06]],[0,1,0],.005,p[3]);
    const g=new THREE.BufferGeometry(); const x=s*.034;
    g.setAttribute('position',new THREE.Float32BufferAttribute([x,.065,-.117,x,.058,-.124,x,.051,-.117,x,.058,-.11],3));
    g.setIndex(s===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();part(root,g,p[3]);
  }
  const tail=pivot(root,'anim_tail',[0,.008,.07]);
  fin(tail,[[-.022,0,0],[-.053,.002,.079],[0,.003,.07],[.053,.002,.079],[.022,0,0]],[0,1,0],.009,p[0],p[1]);
  root.userData.animation={tailAxis:'x',flipperAxis:'z',wing:true};
}

const factories={dolphin,shark,turtle,tropicalfish,seagull};

// Bake each bucket's local transforms and join by material. Animation pivots survive.
function mergeBucket(group, material) {
  const meshes=group.children.filter(o=>o.isMesh), geometries=[];
  for(const mesh of meshes){
    mesh.updateMatrix();
    const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const flat=g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute('uv'); geometries.push(flat);
    mesh.geometry.dispose(); group.remove(mesh);
  }
  if(geometries.length){
    const merged=mergeGeometries(geometries,false);
    const geometry=mergeVertices(merged,1e-6);merged.dispose();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=group.name==='body'?'body_surface':`${group.name}_surface`;
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    for(const g of geometries)g.dispose();
  }
  for(const child of [...group.children])if(child.isGroup)mergeBucket(child,material);
}

/** @param {'dolphin'|'shark'|'turtle'|'tropicalfish'|'seagull'} kind */
export function createAnimal(kind,{low=false}={}) {
  const factory=factories[kind];
  if(!factory)throw new RangeError(`Unknown animal: ${kind}`);
  const group=new THREE.Group();group.name=kind;
  const bodyGroup=new THREE.Group();bodyGroup.name='body';group.add(bodyGroup);
  factory(bodyGroup,low,palettes[kind]);
  const material=new THREE.MeshStandardMaterial({name:`${kind}_vertex_palette`,vertexColors:true,roughness:.72,metalness:0});
  mergeBucket(bodyGroup,material);
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group), size=bounds.getSize(new THREE.Vector3());
  const axis=kind==='seagull'?'x':'z';
  const desired=ANIMAL_SPECS[kind][kind==='seagull'?'wingspan':'length'];
  const scale=desired/size[axis];
  // Bake units into vertices/pivot offsets, retaining a unit root transform.
  group.traverse(o=>{if(o.isMesh)o.geometry.scale(scale,scale,scale);else if(o!==group)o.position.multiplyScalar(scale);});
  group.updateMatrixWorld(true);
  let triangles=0,drawCalls=0;
  group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;drawCalls++;}});
  group.userData={kind,low,units:'metres',up:'+Y',forward:'-Z',triangles,drawCalls,animation:bodyGroup.userData.animation};
  if(triangles>ANIMAL_SPECS[kind].triangleBudget)throw new Error(`${kind} exceeds triangle budget: ${triangles}`);
  return group;
}
