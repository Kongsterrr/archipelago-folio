import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original texture-free toy nautical fleet. Metres; +Y up; bow -Z; sea Y=0.
 * Returns four material-batched meshes, including for low variants. Every hull
 * has a real submerged underbody. No randomness, images, or external assets.
 * Animation attachment positions are local-space metadata, so runtime effects
 * do not prevent batching. Import this module in THREE or use build-fleet.mjs.
 */
export const VESSEL_SPECS = Object.freeze({
  cargo: { length: 14, beam: 4.3, deck: .86, draft: .62, label: 'Tangerine cargo coaster' },
  ferry: { length: 9, beam: 3.4, deck: .69, draft: .48, label: 'Coral two-deck island ferry' },
  fishing: { length: 6, beam: 2.4, deck: .57, draft: .43, label: 'Teal fishing launch' },
  yacht: { length: 11, beam: 3.5, deck: .69, draft: .51, label: 'Ivory flybridge motor yacht' },
  sailboat: { length: 7, beam: 2.4, deck: .52, draft: .46, label: 'Saffron sloop' },
});

const C = { ivory: '#fff5df', orange: '#ef7944', coral: '#ef9370', navy: '#254b60',
  teal: '#65bcae', green: '#96caaa', yellow: '#f1cc6d', teak: '#c59a67',
  seam: '#806747', silver: '#bcc9bd', glass: '#64b9b2', darkglass: '#276274',
  cream: '#ffeac9', white: '#fff9ed', rope: '#dfc6a0' };

export function createVessel(kind, { low = false } = {}) {
  if (!VESSEL_SPECS[kind]) throw new Error(`Unknown vessel kind: ${kind}`);
  const spec = VESSEL_SPECS[kind], { length: L, beam: B, deck: D, draft } = spec;
  const root = new THREE.Group(); root.name = `vessel_${kind}${low ? '_low' : ''}`;
  const bins = new Map(), attachments = {};
  const materials = {
    painted: new THREE.MeshStandardMaterial({ name: 'fleet_painted', vertexColors: true, roughness: .58, metalness: .025 }),
    dark: new THREE.MeshStandardMaterial({ name: 'fleet_dark', vertexColors: true, roughness: .67, metalness: .04 }),
    metal: new THREE.MeshStandardMaterial({ name: 'fleet_metal', vertexColors: true, roughness: .38, metalness: .38 }),
    glass: new THREE.MeshStandardMaterial({ name: 'fleet_glass', vertexColors: true, roughness: .24, metalness: .12 }),
  };
  const add = (geometry, color = 'ivory', pos = [0,0,0], rot = [0,0,0], material = 'painted') => {
    if (geometry.index) geometry = geometry.toNonIndexed();
    for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(key)) geometry.deleteAttribute(key);
    geometry.clearGroups();
    const c = new THREE.Color(C[color] || color), array = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < array.length; i += 3) { array[i] = c.r; array[i+1] = c.g; array[i+2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(array, 3));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1,1,1));
    geometry.applyMatrix4(matrix);
    if (!bins.has(material)) bins.set(material, []); bins.get(material).push(geometry);
  };
  const box = (w,h,d,x,y,z,c = 'ivory', rot = [0,0,0], m = 'painted') => add(new THREE.BoxGeometry(w,h,d),c,[x,y,z],rot,m);
  const custom = (points, faces, c, material = 'painted') => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex(faces);
    const flat=g.toNonIndexed();flat.computeVertexNormals();add(flat,c,[0,0,0],[0,0,0],material);
  };
  const cylinder = (r,h,x,y,z,c='ivory',n=low?5:8,rot=[0,0,0],m='painted',r2=r) => add(new THREE.CylinderGeometry(r,r2,h,n),c,[x,y,z],rot,m);
  const rod = (a,b,r=.026,c='silver',n=low?4:5,m='metal') => {
    const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), delta=bv.clone().sub(av);
    const g=new THREE.CylinderGeometry(r,r,delta.length(),n,1,true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    add(g,c,av.add(bv).multiplyScalar(.5).toArray(),[0,0,0],m);
  };
  const path = (points,r=.027,c='silver',n=low?4:5,m='metal') => { for(let i=1;i<points.length;i++)rod(points[i-1],points[i],r,c,n,m); };
  const torus = (r,t,x,y,z,c='orange',rot=[0,0,0],m='painted',n=12) => add(new THREE.TorusGeometry(r,t,low?3:4,low?8:n),c,[x,y,z],rot,m);
  const bevel = (w,h,d,x,y,z,c='ivory',r=.06,rot=[0,0,0],m='painted') => {
    if(low)return box(w,h,d,x,y,z,c,rot,m);
    r=Math.min(r,w*.2,h*.2,d*.2);const a=w/2-r,b=h/2-r,s=new THREE.Shape();
    s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,steps:1});
    g.translate(0,0,-d/2+r);add(g,c,[x,y,z],rot,m);
  };
  const loft = (rings,c) => { const points=rings.flat(),ix=[],n=rings[0].length;
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;ix.push(a,a+n,b,b,a+n,b+n);} custom(points,ix,c); };
  const fullPlan = [[0,-.5],[.23,-.465],[.37,-.39],[.46,-.28],[.495,-.13],[.5,.12],[.49,.33],[.455,.47],[.37,.5],[-.37,.5],[-.455,.47],[-.49,.33],[-.5,.12],[-.495,-.13],[-.46,-.28],[-.37,-.39],[-.23,-.465]];
  const lowPlan = [[0,-.5],[.4,-.36],[.5,-.10],[.49,.33],[.37,.5],[-.37,.5],[-.49,.33],[-.5,-.10],[-.4,-.36]];
  const plan=(low?lowPlan:fullPlan).map(([x,z])=>[x*B,z*L]);
  const ring = (s,y,zs=1)=>plan.map(([x,z])=>[x*s,y,z*zs]);
  const cap = (outline,y,c,reverse=false)=>{const p=[[0,y,0],...outline.map(([x,z])=>[x,y,z])],ix=[];
    for(let i=0;i<outline.length;i++)ix.push(...(reverse?[0,i+1,(i+1)%outline.length+1]:[0,(i+1)%outline.length+1,i+1]));custom(p,ix,c);};
  const hullColor={cargo:'orange',ferry:'coral',fishing:'teal',yacht:'ivory',sailboat:'yellow'}[kind];
  loft([ring(.51,-draft,.94),ring(.86,-.12,.985),ring(1,D-.12)],hullColor);
  cap(plan.map(([x,z])=>[x*.51,z*.94]),-draft,'navy',true);
  loft([ring(1,D-.12),ring(1,D-.055)],'navy');
  loft([ring(1,D-.055),ring(1,D)],'ivory');cap(plan,D,'teak');
  // Dark waterline chine is visible when the vessel rolls.
  if(!low)loft([ring(.86,-.13,.985),ring(.90,.015,.991)],'navy');
  const rail = (x,z0,z1,y,count=5) => {
    rod([x,y,z0],[x,y,z1],.028);
    if(!low){rod([x,y-.25,z0],[x,y-.25,z1],.019);for(let i=0;i<count;i++){const z=z0+(z1-z0)*i/(count-1);rod([x,D,z],[x,y,z],.027);}}
  };
  const bowRail = (height=.58) => {
    if(low)return;
    const out=plan.filter(([,z])=>z<-L*.1).map(([x,z])=>[x*.91,D+height,z*.94]);
    out.sort((a,b)=>a[0]-b[0]);path(out,.025);
    for(const p of out.filter((_,i)=>i%2===0))rod([p[0],D,p[2]],p,.022);
  };
  const cleat = (x,z) => { cylinder(.055,.08,x,D+.06,z,'silver',6,[0,0,0],'metal');rod([x-.13,D+.11,z],[x+.13,D+.11,z],.032); };
  const window = (w,h,x,y,z,rot=[0,0,0]) => {
    box(w+.055,h+.055,.022,x,y,z,'navy',rot,'dark');box(w,h,.027,x,y,z,'glass',rot,'glass');
  };
  const sideWindow = (s,w,h,y,z,x) => window(w,h,s*x,y,z,[0,s*Math.PI/2,0]);
  const porthole = (s,y,z,x,r=.12) => {
    cylinder(r*1.18,.028,s*x,y,z,'silver',8,[0,0,Math.PI/2],'metal');
    cylinder(r,.038,s*x,y,z,'glass',8,[0,0,Math.PI/2],'glass');
  };
  const lifering = (s,y,z,x) => {
    torus(.23,.064,s*x,y,z,'orange',[0,Math.PI/2,0]);
    for(const dz of[-.23,.23])box(.135,.10,.105,s*x,y,z+dz,'ivory');
  };
  const radar = (x,y,z,w=.8) => {
    cylinder(.075,.3,x,y+.15,z,'silver',low?5:8,[0,0,0],'metal');
    bevel(w,.095,.16,x,y+.32,z,'ivory',.035);
    attachments.radar={position:[x,y+.32,z],axis:'Y',span:w};
  };
  const flag = (x,y,z,c='orange') => {
    rod([x,y-.7,z],[x,y,z],.023,'silver',5);
    custom([[x,y-.02,z],[x+.45,y-.10,z+.05],[x+.30,y-.32,z+.04],[x,y-.25,z]], [0,2,1,0,3,2,0,1,2,0,2,3],c);
  };
  const nav = (y,z,x=B*.4) => {
    attachments.navlights=[{position:[-x,y,z],color:'#ed795f',side:'port'},{position:[x,y,z],color:'#88e0b2',side:'starboard'},{position:[0,D+.2,L*.43],color:'#ffe9bd',side:'stern'}];
    if(!low)for(const s of[-1,1]){box(.14,.08,.19,s*x,y-.035,z,'navy',[0,0,0],'dark');box(.15,.035,.14,s*x,y+.023,z,s<0?'orange':'green');}
  };
  const fenders = (x,zs,y=D-.05) => { if(low)return;x=Math.min(x,B/2-.11);for(const s of[-1,1])for(const z of zs){rod([s*(x-.08),D+.22,z],[s*x,y+.12,z],.016,'rope',4,'painted');cylinder(.105,.40,s*x,y,z,'ivory',7);} };
  const seams = (w,z0,z1,y=D+.009,n=6) => {if(low)return;for(let i=0;i<n;i++)box(.012,.008,z1-z0,-w/2+w*i/(n-1),y,(z0+z1)/2,'seam');};

  if(kind==='cargo') {
    // Broad coaster, ribbed orange/teal containers and an aft bridge tower.
    const container=(x,y,z,c,w=1.64,h=1.28,d=3.05)=>{
      bevel(w,h,d,x,y,z,c,.045);
      if(!low){
        for(const s of[-1,1])for(let i=0;i<7;i++)box(.035,h-.13,.035,x+s*(w/2+.008),y,z-d*.4+i*d*.8/6,'ivory');
        for(const s of[-1,1])for(const dy of[-h*.43,h*.43])box(w+.028,.038,.025,x,y+dy,z+s*(d/2+.009),'navy');
        for(const dx of[-w*.25,w*.25])rod([x+dx,y-h*.42,z+d/2+.026],[x+dx,y+h*.42,z+d/2+.026],.017,'silver',4);
      }
    };
    for(const x of[-.85,.85]){container(x,D+.64,-3.35,x<0?'teal':'orange');container(x,D+.64,-.16,x<0?'yellow':'teal');}
    if(!low){container(-.85,D+1.92,-3.35,'coral');container(.85,D+1.92,-.16,'ivory');}
    else container(0,D+1.80,-1.72,'ivory',3.3,1.05,3.0);
    bevel(3.03,1.55,2.55,0,D+.775,4.46,'ivory',.09);
    bevel(3.45,1.08,1.92,0,D+2.06,4.10,'ivory',.11);
    bevel(3.65,.16,2.11,0,D+2.65,4.1,'navy',.035,[0,0,0],'dark');
    if(low)box(2.9,.47,.025,0,D+2.13,3.128,'glass',[0,0,0],'glass');
    else{
      for(const x of[-1.12,-.38,.38,1.12])window(.61,.49,x,D+2.12,3.125);
      for(const s of[-1,1]){sideWindow(s,.64,.48,D+2.12,4.04,1.734);sideWindow(s,.48,.57,D+.87,4.05,1.524);lifering(s,D+.88,5.20,1.54);}
      box(.58,1.00,.027,.70,D+.52,5.75,'teal');window(.30,.25,.70,D+.76,5.768);
      for(let i=0;i<5;i++)box(.64,.06,.25,-.88,D+.10+i*.16,5.66-i*.17,'silver',[0,0,0],'metal');
      rail(-1.90,2.5,6.30,D+.59,5);rail(1.90,2.5,6.30,D+.59,5);
      for(const x of[-1.32,1.32]){cleat(x,5.94);cleat(x,-5.5);}
      cylinder(.23,.54,0,D+.29,-5.7,'navy',10,[0,0,0],'dark');rod([-.44,D+.59,-5.7],[.44,D+.59,-5.7],.045);
      for(const x of[-1.5,1.5])box(.18,.41,.2,x,D+2.90,4.71,'orange');
      flag(-1.18,D+3.48,4.7);fenders(2.11,[-3.8,-.2,3.3,5.7]);
    }
    cylinder(.28,.92,.70,D+3.02,4.65,'orange',low?5:8);cylinder(.32,.13,.70,D+3.54,4.65,'navy',low?5:8,[0,0,0],'dark');
    radar(-.48,D+2.73,4.04,1.13);nav(D+2.76,3.49,1.70);
  }

  if(kind==='ferry') {
    // Two open-edged decks, panoramic windows, orange funnels and davit boats.
    bevel(2.70,1.30,5.70,0,D+.65,.12,'ivory',.1);
    bevel(3.08,.18,6.29,0,D+1.39,.12,'ivory',.04);
    bevel(2.45,1.07,4.43,0,D+2.015,-.05,'ivory',.11);
    bevel(2.78,.17,4.81,0,D+2.63,-.05,'coral',.06);
    if(low){
      for(const s of[-1,1]){box(.028,.64,4.95,s*1.362,D+.75,.1,'glass',[0,0,0],'glass');box(.028,.53,3.5,s*1.236,D+2.12,-.1,'glass',[0,0,0],'glass');}
      box(2.04,.50,.028,0,D+2.13,-2.28,'glass',[0,0,0],'glass');
    }else{
      for(const s of[-1,1]){
        for(const z of[-2.1,-1.05,0,1.05,2.1])sideWindow(s,.79,.63,D+.75,z,1.363);
        for(const z of[-1.54,-.53,.48,1.49])sideWindow(s,.71,.54,D+2.10,z,1.24);
        rail(s*1.44,-2.67,2.8,D+1.97,7);lifering(s,D+.8,3.00,1.24);
        // Compact covered tender/lifeboat, with orange outer shell and cream lid.
        bevel(.39,.40,1.67,s*1.40,D+1.85,2.01,'orange',.09);bevel(.35,.12,1.25,s*1.40,D+2.10,2.01,'ivory',.04);
        for(const z of[1.39,2.56])path([[s*1.06,D+1.5,z],[s*1.08,D+2.43,z],[s*1.53,D+2.37,z]],.035);
      }
      for(const x of[-.77,0,.77]){window(.64,.54,x,D+2.12,-2.278);window(.66,.56,x,D+.78,-2.743);}
      for(const x of[-.63,.63]){box(.70,.11,.46,x,D+1.65,-2.73,'teal');box(.70,.40,.12,x,D+1.91,-2.51,'ivory');}
      for(const z of[3.04,3.37])box(1.42,.07,.28,0,D+.05,z,'ivory');
      bowRail(.64);fenders(1.64,[-2.9,0,2.7]);seams(1.6,2.94,3.65);flag(-.80,D+3.3,1.83);
    }
    for(const x of[-.53,.53]){bevel(.43,.74,.59,x,D+3.04,.96,'orange',.07);box(.45,.15,.61,x,D+3.44,.96,'navy',[0,0,0],'dark');}
    radar(0,D+2.77,-1.20,.84);nav(D+2.74,-1.95,1.29);
  }

  if(kind==='fishing') {
    // Raised wheelhouse leaves a busy stern work deck and recognizable trawl A-frame.
    bevel(1.60,1.15,1.67,0,D+.575,-1.05,'ivory',.075);
    bevel(1.88,.13,1.94,0,D+1.215,-1.05,'orange',.035);
    if(low){box(1.33,.47,.028,0,D+.85,-1.897,'glass',[0,0,0],'glass');for(const s of[-1,1])box(.028,.48,.89,s*.808,D+.83,-1.1,'glass',[0,0,0],'glass');}
    else{
      window(.59,.50,-.35,D+.84,-1.897);window(.59,.50,.35,D+.84,-1.897);
      for(const s of[-1,1]){sideWindow(s,.77,.48,D+.83,-1.24,.815);porthole(s,D+.20,-1.8,1.09,.105);lifering(s,D+.64,-.44,.83);}
      box(.53,.83,.027,.18,D+.43,-.20,'teal');window(.28,.32,.18,D+.57,-.18);
      for(const s of[-1,1])rail(s*1.02,.01,2.42,D+.40,5);
      bowRail(.43);fenders(1.14,[-1.90,.60,2.04]);seams(1.6,.02,2.42,undefined,8);
    }
    for(const s of[-1,1])rod([s*.86,D+.03,1.32],[s*.75,D+2.19,1.12],.060,'orange',low?4:6,'painted');
    rod([-.75,D+2.19,1.12],[.75,D+2.19,1.12],.060,'orange',low?4:6,'painted');
    // Green hanging net: opaque polygon with hand-authored rope lattice in the high asset.
    custom([[-.63,D+1.89,1.14],[.63,D+1.89,1.14],[.48,D+.63,1.52],[-.36,D+.49,1.48]], [0,2,1,0,3,2,0,1,2,0,2,3],'green');
    if(!low){
      for(let i=0;i<6;i++){const t=i/5;rod([-.63+1.26*t,D+1.89,1.16],[-.36+.84*t,D+.49+.14*t,1.52],.014,'rope',4,'painted');}
      for(let i=0;i<5;i++){const t=i/4;rod([-.63+.27*t,D+1.89-1.4*t,1.16+.34*t],[.63-.15*t,D+1.89-1.26*t,1.16+.38*t],.014,'rope',4,'painted');}
      for(const s of[-1,1]){cylinder(.105,.31,s*.94,D+.45,2.03,'orange',7);cylinder(.105,.12,s*.94,D+.68,2.03,'ivory',7);}
      for(let i=0;i<3;i++)torus(.22+i*.07,.027,-.54,D+.04+i*.025,.33,'rope',[Math.PI/2,0,0],'painted',14);
      cylinder(.19,.34,.44,D+.2,.33,'teal',10);torus(.19,.022,.44,D+.38,.33,'ivory',[Math.PI/2,0,0]);
      // Silvery catch in two slatted fish boxes; visible from the following camera.
      for(const [x,z,c]of[[-.45,2.06,'orange'],[.42,2.09,'teal']]){
        box(.65,.34,.61,x,D+.17,z,c);box(.55,.026,.50,x,D+.351,z,'navy',[0,0,0],'dark');
        for(const dx of[-.16,0,.16]){const g=new THREE.OctahedronGeometry(.13);g.scale(.46,.32,1.6);add(g,'silver',[x+dx,D+.40,z],[0,.25,0],'metal');}
        for(const dy of[-.07,.05])box(.67,.019,.02,x,D+.18+dy,z+.32,'ivory');
      }
      flag(.64,D+2.10,-.97,'teal');
    }else{box(.66,.33,.64,-.44,D+.17,2.10,'orange');box(.66,.33,.64,.40,D+.17,2.10,'teal');}
    radar(0,D+1.30,-1.00,.66);nav(D+1.33,-1.58,.80);
  }

  if(kind==='yacht') {
    // Long raked ivory superstructure, open aft salon, flybridge and teak sunbeds.
    const cabin=(w,h,z0,z1,y,c)=>{
      const w2=w*.82;const p=[[-w/2,y,z0],[w/2,y,z0],[-w/2,y,z1],[w/2,y,z1],[-w2/2,y+h,z0+.48],[w2/2,y+h,z0+.48],[-w2/2,y+h,z1],[w2/2,y+h,z1]];
      custom(p,[0,4,1,1,4,5,0,2,4,2,6,4,1,5,3,3,5,7,2,3,6,3,7,6,4,6,5,5,6,7,0,1,2,1,3,2],c);
    };
    cabin(2.72,1.06,-2.50,2.0,D,'ivory');
    bevel(2.63,.16,3.95,0,D+1.14,.08,'ivory',.055);
    cabin(2.02,.82,-1.15,1.45,D+1.22,'ivory');
    bevel(2.27,.12,2.46,0,D+2.10,.28,'ivory',.04);
    // Windows trace the sloping bow side of each deck.
    for(const s of[-1,1]){
      const x=s*1.275,xt=s*1.145;
      custom([[x,D+.28,-2.13],[x,D+.28,1.49],[xt,D+.89,1.49],[xt,D+.89,-1.87]],s>0?[0,2,1,0,3,2]:[0,1,2,0,2,3],'darkglass','glass');
      box(.026,.43,1.65,s*.92,D+1.69,.22,'glass',[0,0,0],'glass');
      if(!low){
        for(const z of[-1.28,-.10,1.1])rod([s*1.292,D+.27,z],[s*1.14,D+.91,z],.032,'ivory',4,'painted');
        rail(s*1.56,-1.8,4.53,D+.54,8);
        for(const z of[-2.5,-1.30,.12,1.64])porthole(s,D-.27,z,1.55,.11);
      }
    }
    box(1.75,.44,.028,0,D+1.69,-.91,'glass',[0,0,0],'glass');
    const lounger=(x,z,y,w=.70)=>{bevel(w,.17,1.24,x,y+.10,z,'cream',.05);bevel(w,.40,.17,x,y+.34,z+.55,'cream',.045,[-.29,0,0]);if(!low){for(const dx of[-w*.34,w*.34])rod([x+dx,y-.09,z-.4],[x+dx,y+.03,z+.4],.025);box(w-.12,.008,.015,x,y+.195,z-.40,'orange');}};
    for(const x of[-.54,.54])lounger(x,-3.38,D+.015,.80);
    for(const x of[-.53,.53])lounger(x,3.45,D+.02,.77);
    if(!low){
      bowRail(.57);seams(2.42,2.1,4.75,undefined,10);
      for(const x of[-.71,.71]){bevel(.61,.13,.64,x,D+1.42,.37,'cream',.025);bevel(.62,.57,.14,x,D+1.68,.68,'cream',.04);}
      // Aft dining table and wraparound salon couch.
      cylinder(.048,.47,0,D+.25,2.49,'silver',6,[0,0,0],'metal');bevel(.85,.075,.48,0,D+.52,2.49,'teak',.03);
      for(const x of[-1.13,1.13]){bevel(.35,.21,1.35,x,D+.23,2.86,'cream',.04);bevel(.14,.43,1.45,x*1.09,D+.45,2.86,'cream',.04);}
      for(const x of[-.98,.98])cleat(x,4.62);
      for(const y of[D-.06,D+.08,D+.20])box(1.87,.075,.30,0,y,4.87-(y-D)*1.7,'ivory');
      fenders(1.70,[-.7,2.32]);flag(-1.20,D+1.18,4.4,'orange');
    }
    // Radar arch and two polished aerials keep the flybridge silhouette delicate.
    path([[-.89,D+2.08,.52],[-.72,D+2.63,.63],[.72,D+2.63,.63],[.89,D+2.08,.52]],.065,'ivory',low?4:6,'painted');
    radar(0,D+2.63,.63,.95);nav(D+1.34,-1.38,1.26);
    if(!low)for(const x of[-.56,.56])rod([x,D+2.68,.64],[x,D+3.17,.69],.013,'silver',4);
  }

  if(kind==='sailboat') {
    // Tall sloop with an ivory mainsail, saffron jib, stitched panels and taut stays.
    bevel(1.46,.41,2.24,0,D+.205,-.18,'ivory',.065);
    for(const s of[-1,1]){
      if(low)box(.025,.17,1.26,s*.738,D+.24,-.17,'glass',[0,0,0],'glass');
      else for(const z of[-.87,-.29,.28])sideWindow(s,.40,.19,D+.25,z,.744);
    }
    const mastZ=-.58, mastTop=7.90;
    rod([0,D,mastZ],[0,mastTop,mastZ],.052,'silver',low?5:8);
    rod([0,D+1.19,mastZ],[.12,D+1.19,2.58],.044,'silver',low?4:6);
    // Slight camber along the central seam catches the warm ocean light.
    const main=[[.045,D+1.30,mastZ+.05],[.045,mastTop-.16,mastZ+.05],[.45,D+3.38,1.20],[.16,D+1.30,2.48]];
    custom(main,[0,2,1,0,3,2,0,1,2,0,2,3],'ivory');
    const jib=[[-.025,D+.74,-3.16],[-.025,mastTop-.45,mastZ-.065],[-.31,D+1.13,mastZ-.16],[-.33,D+3.10,-1.55]];
    custom(jib,[0,3,1,1,3,2,0,2,3,0,1,3,1,2,3,0,3,2],'yellow');
    if(!low){
      path([main[0],main[1],main[2],main[3],main[0]],.012,'rope',4,'painted');
      rod([-.025,D+.76,-3.17],[0,mastTop-.05,mastZ],.017,'navy',4,'dark');
      rod([0,mastTop-.04,mastZ],[0,D+.16,2.97],.017,'navy',4,'dark');
      for(const s of[-1,1])rod([s*1.03,D+.10,-.18],[0,mastTop-.32,mastZ],.015,'navy',4,'dark');
      for(const t of[.21,.42,.63]){
        const y=D+1.3+(mastTop-.16-D-1.3)*t,z=2.48+(mastZ+.05-2.48)*t;
        rod([.052,y,mastZ+.05],[.16+(1-t)*.12,y,z],.010,'teak',4,'painted');
      }
      // Small geometric sail insignia, avoiding font or texture dependencies.
      custom([[.070,6.07,-.35],[.090,5.46,-.35],[.235,5.58,.15]],[0,2,1,0,1,2],'orange');
      for(const s of[-1,1]){rail(s*1.07,-1.62,2.54,D+.45,6);bevel(.27,.13,1.33,s*.63,D+.15,1.89,'cream',.035);}
      bowRail(.45);seams(1.14,.98,2.90,undefined,7);
      // Recessed cockpit well, helm, two winches and a coiled mainsheet.
      box(.76,.025,1.40,0,D+.027,1.85,'navy',[0,0,0],'dark');box(.58,.025,1.05,0,D+.043,1.86,'teak');
      rod([0,D+.05,2.19],[0,D+.71,2.12],.035);
      torus(.205,.024,0,D+.66,2.11,'silver',[.15,0,0],'metal',12);
      for(const s of[-1,1]){cylinder(.095,.16,s*.82,D+.10,.98,'silver',8,[0,0,0],'metal');cleat(s*.73,2.77);}
      for(let i=0;i<2;i++)torus(.14+i*.04,.018,.50,D+.045+i*.014,.93,'rope',[Math.PI/2,0,0],'painted',12);
      fenders(1.13,[.9,2.16]);flag(-.78,D+1.10,2.70,'teal');
    } else {
      box(.75,.035,1.28,0,D+.03,1.84,'navy',[0,0,0],'dark');
      rod([0,mastTop-.04,mastZ],[0,D+.13,2.9],.014,'navy',4,'dark');
      rod([0,mastTop-.04,mastZ],[0,D+.7,-3.1],.014,'navy',4,'dark');
    }
    // Keel and rudder stay submerged and inside the hull envelope.
    box(.10,.39,1.10,0,-draft-.13,.19,'navy',[0,0,0],'dark');
    attachments.masthead={position:[0,mastTop,mastZ]};nav(D+.62,-1.17,.91);
  }

  attachments.propeller={position:[0,-.20,L*.42],axis:'Z',radius:kind==='cargo'?.30:.20};
  root.userData={originalProceduralAsset:true,author:'Jack portfolio V3 original fleet builder',kind,quality:low?'low':'high',
    forward:'-Z',seaLevel:0,units:'meters',length:L,beam:B,design:spec.label,attachments};
  // Batching includes vertex colors: no material proliferation for little details.
  for(const [material,geometries] of bins){
    const merged=mergeGeometries(geometries,false);const geometry=mergeVertices(merged,1e-5);geometry.normalizeNormals();
    const mesh=new THREE.Mesh(geometry,materials[material]);mesh.name=`static_${material}`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    for(const g of geometries)g.dispose();merged.dispose();
  }
  root.updateMatrixWorld(true);return root;
}
