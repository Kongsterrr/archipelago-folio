import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original Jack figure. Rigid weights keep toy clothing crisp while one shared
 * skeleton drives every mesh. Metres, Y up, feet at Y=0, forward -Z. */
export const JACK_SPEC = Object.freeze({
  height: 1.30,
  forward: '-Z',
  helmAnchor: [.28324, -.4496, .00485],
  helmScale: .97,
  helmAuthorAnchor: [.292, .32, .005],
  benchAnchorHeight: .32,
  clips: ['idle', 'walk', 'run', 'helm', 'interact', 'sit', 'stand'],
});

export function createJackCharacter() {
  const root = new THREE.Group(); root.name = 'Jack';
  const bones = [], byName = {};
  const bone = (name, parent, x=0, y=0, z=0) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x,y,z);
    (parent || root).add(b); bones.push(b); byName[name] = b; return b;
  };
  const hips=bone('Hips',null,0,.58,0), spine=bone('Spine',hips,0,.11,0), chest=bone('Chest',spine,0,.15,0);
  const neck=bone('Neck',chest,0,.135,0), head=bone('Head',neck,0,.10,0);
  for(const [side,s] of [['Left',-1],['Right',1]]) {
    const arm=bone(`${side}Arm`,chest,s*.166,.078,0);
    const elbow=bone(`${side}ForeArm`,arm,0,-.19,0);
    bone(`${side}Hand`,elbow,0,-.17,0);
    const thigh=bone(`${side}UpLeg`,hips,s*.078,-.02,0);
    const shin=bone(`${side}Leg`,thigh,0,-.235,0);
    bone(`${side}Foot`,shin,0,-.245,0);
  }
  root.updateMatrixWorld(true);
  const materials = {
    skin: new THREE.MeshStandardMaterial({name:'Jack_Skin',color:'#dba779',roughness:.84}),
    jacket: new THREE.MeshStandardMaterial({name:'Jack_CreamCanvas',color:'#f4eedc',roughness:.93}),
    navy: new THREE.MeshStandardMaterial({name:'Jack_NavyKnit',color:'#274554',roughness:.90}),
    dark: new THREE.MeshStandardMaterial({name:'Jack_HairAndDenim',color:'#ffffff',roughness:.86,vertexColors:true}),
    shoe: new THREE.MeshStandardMaterial({name:'Jack_IvorySneakers',color:'#e3e9e2',roughness:.75}),
    accent: new THREE.MeshStandardMaterial({name:'Jack_OrangeDetails',color:'#e99051',roughness:.70}),
  };
  const bins=new Map(Object.entries(materials).map(([key])=>[key,[]]));
  const part=(g,mat,joint,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0],color=null)=>{
    const b=byName[joint],m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale));
    g.applyMatrix4(b.matrixWorld.clone().multiply(m));
    for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);
    g.clearGroups(); if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    const n=g.attributes.position.count,indices=new Uint16Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3);
    const tint=new THREE.Color(color||'#ffffff');
    for(let i=0;i<n;i++){indices[i*4]=bones.indexOf(b);weights[i*4]=1;colors.set(tint.toArray(),i*3);}
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    if(mat==='dark')g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    bins.get(mat).push(g);
  };
  const orb=(mat,joint,pos,scale,seg=12,rings=8,color)=>part(new THREE.SphereGeometry(1,seg,rings),mat,joint,pos,scale,undefined,color);
  const cube=(mat,joint,pos,size,rot=[0,0,0],radius=.025,color)=>{
    const [w,h,d]=size,r=Math.min(radius,w*.23,h*.23,d*.23),a=w/2-r,b=h/2-r,s=new THREE.Shape();
    s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1,curveSegments:1});
    g.translate(0,0,-d/2+r);part(g,mat,joint,pos,undefined,rot,color);
  };
  const rod=(mat,joint,a,b,r=.008,n=8,color)=>{
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
    const g=new THREE.CylinderGeometry(r,r,delta.length(),n,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    part(g,mat,joint,va.add(vb).multiplyScalar(.5).toArray(),undefined,undefined,color);
  };
  // A soft, squared face: visible ears, little nose, warm cheeks and a small smile.
  orb('skin','Head',[0,.018,0],[.135,.161,.121],16,12);
  orb('skin','Head',[-.132,.013,0],[.032,.047,.026],10,7);
  orb('skin','Head',[.132,.013,0],[.032,.047,.026],10,7);
  orb('skin','Head',[0,-.005,-.123],[.025,.025,.029],10,7);
  for(const x of [-.052,.052]){
    orb('dark','Head',[x,.041,-.113],[.014,.020,.008],10,7,'#202326');
    orb('jacket','Head',[x-.003,.047,-.121],[.0045,.0055,.0025],7,5);
    rod('dark','Head',[x-.016,.076,-.106],[x+.014,.077,-.108],.006,6,'#38302a');
  }
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.022,-.047,-.113),new THREE.Vector3(0,-.053,-.120),new THREE.Vector3(.022,-.047,-.113)]);
  part(new THREE.TubeGeometry(smile,8,.0034,5,false),'dark','Head',undefined,undefined,undefined,'#634631');
  // Dark short hair has a cap, temple pieces and swept sculpted locks, never a helmet rim over the face.
  part(new THREE.SphereGeometry(1,16,7,0,Math.PI*2,0,Math.PI*.40),'dark','Head',[0,.035,.006],[.140,.190,.127],undefined,'#302b29');
  for(const [x,y,z,sx,ry] of [[-.087,.156,-.046,.055,-.34],[-.036,.177,-.055,.061,-.24],[.024,.177,-.043,.064,.06],[.078,.153,-.020,.05,.25]]){
    orb('dark','Head',[x,y,z],[sx,.046,.082],10,7,'#3b332e');
  }
  for(const x of [-.127,.127])cube('dark','Head',[x,.048,.017],[.023,.088,.085],[0,0,x<0?-.09:.09],.009,'#302b29');
  // Cream jacket opened over a navy knit. Lapels, patch pocket and orange zip pull make it legible up close.
  orb('skin','Neck',[0,.018,0],[.048,.059,.045],10,7);
  cube('navy','Chest',[0,-.072,-.014],[.158,.287,.152],undefined,.045);
  cube('jacket','Chest',[-.092,-.074,.007],[.131,.301,.194],[0,0,-.025],.035);
  cube('jacket','Chest',[.092,-.074,.007],[.131,.301,.194],[0,0,.025],.035);
  cube('jacket','Chest',[0,-.064,.082],[.300,.285,.074],undefined,.025);
  for(const s of [-1,1]) {
    cube('jacket','Chest',[s*.060,.057,-.092],[.047,.083,.027],[0,0,s*.29],.009);
    rod('navy','Chest',[s*.029,.006,-.105],[s*.039,-.194,-.105],.004,5);
    cube('navy','Chest',[s*.103,-.135,-.097],[.051,.008,.006],[0,0,s*.09],.002);
  }
  cube('jacket','Chest',[-.097,-.001,-.101],[.057,.055,.009],undefined,.006);
  cube('accent','Chest',[-.097,.017,-.108],[.027,.006,.006],undefined,.002);
  cube('accent','Chest',[.037,-.115,-.109],[.008,.024,.008],undefined,.003);
  cube('navy','Spine',[0,-.052,0],[.252,.057,.169],undefined,.020);
  cube('dark','Hips',[0,.003,0],[.242,.136,.183],undefined,.037,'#334958');
  cube('dark','Hips',[0,.059,-.003],[.251,.026,.186],undefined,.008,'#263c48');
  cube('accent','Hips',[0,.060,-.101],[.027,.025,.005],undefined,.004);
  // Layered cuffs, joint caps, trouser seams, and broad shoes with distinct soles and three laces.
  for(const [side,s]of [['Left',-1],['Right',1]]){
    orb('jacket',`${side}Arm`,[0,-.058,0],[.063,.096,.063],10,8);
    cube('jacket',`${side}Arm`,[0,-.105,0],[.108,.167,.114],[0,0,-s*.035],.032);
    orb('jacket',`${side}ForeArm`,[0,-.063,0],[.050,.086,.053],10,8);
    cube('navy',`${side}ForeArm`,[0,-.137,0],[.087,.042,.091],undefined,.011);
    cube('jacket',`${side}ForeArm`,[0,-.143,0],[.093,.018,.095],undefined,.006);
    orb('skin',`${side}Hand`,[0,-.011,-.002],[.038,.048,.034],10,8);
    orb('skin',`${side}Hand`,[-s*.030,-.004,-.014],[.016,.025,.020],8,6);
    if(side==='Left'){
      cube('dark',`${side}ForeArm`,[-.048,-.127,0],[.011,.027,.048],undefined,.003,'#203541');
      cube('shoe',`${side}ForeArm`,[-.055,-.127,-.005],[.003,.019,.028],undefined,.001);
    }
    cube('dark',`${side}UpLeg`,[0,-.100,0],[.116,.240,.134],undefined,.034,'#334958');
    orb('dark',`${side}Leg`,[0,-.006,0],[.055,.060,.065],10,7,'#334958');
    cube('dark',`${side}Leg`,[0,-.120,.002],[.105,.249,.117],undefined,.024,'#334958');
    rod('dark',`${side}Leg`,[s*.044,-.035,.028],[s*.044,-.215,.029],.0027,4,'#526876');
    cube('navy',`${side}Leg`,[0,-.225,.002],[.111,.026,.123],undefined,.007);
    cube('shoe',`${side}Foot`,[0,-.031,-.036],[.139,.083,.243],undefined,.025);
    cube('jacket',`${side}Foot`,[0,-.065,-.036],[.146,.030,.251],undefined,.010);
    cube('navy',`${side}Foot`,[0,-.012,.055],[.105,.035,.037],undefined,.009);
    cube('accent',`${side}Foot`,[s*.062,-.024,-.029],[.008,.026,.090],[0,0,s*.04],.002);
    for(const z of [-.069,-.046,-.023])rod('jacket',`${side}Foot`,[-.030,.004,z],[.030,.004,z],.003,5);
  }
  const skeleton=new THREE.Skeleton(bones); skeleton.calculateInverses();
  for(const [key,gs]of bins){
    const geometry=mergeVertices(mergeGeometries(gs,false),1e-6);geometry.normalizeNormals();
    const mesh=new THREE.SkinnedMesh(geometry,materials[key]);mesh.name=materials[key].name;mesh.bind(skeleton);mesh.castShadow=true;mesh.receiveShadow=true;
    // A dynamic character can leave bind-pose bounds; the one small hero is always renderable.
    mesh.frustumCulled=false;root.add(mesh);
  }
  const bind=Object.fromEntries(bones.map(b=>[b.name,{p:b.position.toArray(),q:b.quaternion.toArray()}]));
  const pose=(state,t)=>{
    const r=Object.fromEntries(bones.map(b=>[b.name,{p:[...bind[b.name].p],r:[0,0,0]}]));
    const p=(n,x=0,y=0,z=0)=>{r[n].r=[x,y,z];};
    const cycle=state==='run'?Math.PI*2*t/.62:Math.PI*2*t/.92;
    const seat=state==='helm'||state==='sit';
    if(seat){
      for(const side of ['Left','Right']){p(`${side}UpLeg`,1.48);p(`${side}Leg`,-1.48);p(`${side}Foot`,0);}
      p('Spine',-.12);p('Chest',.025);
      if(state==='helm'){
        p('LeftArm',.64,0,.20);p('RightArm',.64,0,-.20);
        p('LeftForeArm',.08);p('RightForeArm',.08);p('Head',0,Math.sin(t*Math.PI)*.025);
      } else {
        p('LeftArm',.50,0,.17);p('RightArm',.50,0,-.17);
        p('LeftForeArm',.82);p('RightForeArm',.82);p('Head',-.04,Math.sin(t*Math.PI)*.055);
      }
    } else if(state==='walk'||state==='run'){
      const running=state==='run',amp=running?.81:.48;
      r.Hips.p[1]+=(running?.029:.014)*Math.sin(cycle*2);
      p('Spine',running?-.14:-.035,Math.sin(cycle)*.045);p('Head',running?.08:.03);
      for(const [side,s]of [['Left',1],['Right',-1]]){
        const swing=Math.sin(cycle)*s;p(`${side}UpLeg`,swing*amp);
        p(`${side}Leg`,-Math.max(0,-swing)*(running?1.0:.52));
        p(`${side}Foot`,Math.max(0,swing)*.15);
        p(`${side}Arm`,-swing*(running?.63:.39),0,side==='Left'?.07:-.07);
        p(`${side}ForeArm`,running?.98:.16);
      }
    } else if(state==='stand'){
      const u=Math.min(1,t/.6),seated=1-u*u*(3-2*u);
      for(const side of ['Left','Right']){p(`${side}UpLeg`,1.48*seated);p(`${side}Leg`,-1.48*seated);}
      p('Spine',-.12*seated);p('Chest',.025*seated);
      p('LeftArm',.50*seated,0,.07+.10*seated);p('RightArm',.50*seated,0,-.07-.10*seated);
      p('LeftForeArm',.82*seated);p('RightForeArm',.82*seated);
    } else if(state==='interact'){
      const ease=Math.sin(Math.PI*Math.min(1,t/1.1));
      p('RightArm',ease*1.15,0,-.12);p('RightForeArm',ease*.34);p('RightHand',0,0,Math.sin(t*9)*ease*.12);p('Head',ease*.07,-ease*.09);
    } else {
      const breathe=Math.sin(t*Math.PI);
      p('LeftArm',0,0,.07);p('RightArm',0,0,-.07);
      p('Chest',breathe*.012);p('Head',-.01,Math.sin(t*Math.PI*.5)*.035);
    }
    return r;
  };
  const animations=[];
  for(const state of JACK_SPEC.clips){
    const duration=state==='walk'?.92:state==='run'?.62:state==='interact'?1.1:state==='stand'?.6:2;
    const frames=state==='walk'||state==='run'?16:12,times=Array.from({length:frames+1},(_,i)=>duration*i/frames);
    const poses=times.map(t=>pose(state,t));
    // One-shot interact ends at the regular idle pose. Stand is a short neutral target
    // while the runtime adjusts root height from bench placement to the island floor.
    const tracks=[];
    for(const b of bones){
      const values=[];for(const pp of poses)values.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...pp[b.name].r)).toArray());
      tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,values));
    }
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position',times,poses.flatMap(pp=>pp.Hips.p)));
    animations.push(new THREE.AnimationClip(state,duration,tracks));
  }
  root.animations=animations;
  root.userData={originalProceduralAsset:true,...JACK_SPEC,rig:'rigid-weight shared skeleton',benchPlacement:'Set root Y to bench seat surface minus 0.52; sit clip keeps pelvis height. Cross-fade sit/stand while runtime adjusts the root to floor level.',helm:'Parent beneath runtime boatVisual; position [.28324,-.4496,.00485], scale .97, identity rotation. This includes the boat builder baked transform (scale .97, Y -.76). Restore scale 1 on land. Clip helm does not move root.'};
  root.updateMatrixWorld(true);
  return {root,bones:byName,skeleton,animations,materials};
}
