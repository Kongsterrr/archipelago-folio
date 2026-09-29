// Owner-supplied Tripo road bicycle. The original is a single Y-up mesh whose
// front points -X. All component selection happens before any lossy operation.
// Every original triangle belongs to exactly one authored part.
export const BICYCLE_SOURCE = Object.freeze({
  scale: 1.35,
  frontAxle: [-.296, .203, 0], rearAxle: [.298, .203, 0],
  wheelRadius: .203,
  saddle: [.145, .535, 0],
  grips: {left: [-.315, .522, .13], right: [-.315, .522, -.13]},
  crank: [.045, .164, 0],
  pedal: [-.035, .218, .102],
});

export const BICYCLE_RIG = Object.freeze({
  version: 1,
  wheelRadius: .203 * 1.35,
  crankRadius: .055,
  saddleTop: [0, .565, .10],
  steeringPivot: [0, .594, -.2835],
  grips: {left: [-.20, .85, -.17], right: [.20, .85, -.17]},
  crankCenter: [0, .43, .04],
  pedalOffset: .145,
  pedalThickness: .020,
  frontAxle: [0, .203 * 1.35, -.296 * 1.35],
  rearAxle: [0, .203 * 1.35, .298 * 1.35],
});

const distanceToSegment = (x,y,ax,ay,bx,by) => {
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  return {distance:Math.hypot(x-ax-t*dx,y-ay-t*dy),t};
};

// The imported adult frame is fitted to Jack's unchanged short-legged rig.
// This is a compact, lowered top tube and raised short-crank geometry, rather
// than burying his pelvis in the top tube or stretching his skeleton.
const frameJoints = [
  {old:[-.210,.445], delta:[0,0]},
  {old:[.125,.445], delta:[.10-.125*1.35,.49-.445*1.35]},
  {old:[.045,.164], delta:[.04-.045*1.35,.43-.164*1.35]},
  {old:[.298,.203], delta:[0,0]},
];
const frameEdges=[[0,1],[1,2],[0,2],[2,3],[1,3]];

export function compactBicycleFrame(x,y,z){
  const p=[-z*1.35,y*1.35,x*1.35];
  // The forward fork, stem and wheels retain their imported cross sections.
  if(x<-.225)return p;
  let nearest={distance:Infinity,t:0,edge:null};
  for(const edge of frameEdges){
    const a=frameJoints[edge[0]].old,b=frameJoints[edge[1]].old;
    const q=distanceToSegment(x,y,...a,...b);
    if(q.distance<nearest.distance)nearest={...q,edge};
  }
  const a=frameJoints[nearest.edge[0]].delta,b=frameJoints[nearest.edge[1]].delta,t=nearest.t;
  p[2]+=a[0]*(1-t)+b[0]*t;p[1]+=a[1]*(1-t)+b[1]*t;
  return p;
}

export function classifyBicycleTriangle(position,a,b,c){
  const x=(position[a*3]+position[b*3]+position[c*3])/3;
  const y=(position[a*3+1]+position[b*3+1]+position[c*3+1])/3;
  const z=(position[a*3+2]+position[b*3+2]+position[c*3+2])/3;
  // Complete radial envelopes keep the sidewalls and every spoke segment.
  for(const [id,center] of [['front',BICYCLE_SOURCE.frontAxle],['rear',BICYCLE_SOURCE.rearAxle]]){
    const r=Math.hypot(x-center[0],y-center[1]);
    if(r<.211 && Math.abs(z)<.0185) return `wheel-${id}`;
    if(r<.055 && Math.abs(z)<.031 && (y<center[1]+.018 || Math.abs(x-center[0])>.021))return `wheel-${id}`;
  }
  if(y>.477 && x>.055)return 'saddle';
  // The source drop-bar brake tips extend below the stem's height. They are
  // outboard of the fork and must share the bar's sweep; leaving them behind
  // produces two floating black fragments after adapting the cockpit.
  if((y>.470 && x<-.16)||(y>.435&&x<-.175&&Math.abs(z)>.048))return 'handlebar';
  // The fused source's two crank arms point forward together. Separating the
  // pedals allows an opposite half-cycle and flat foot contact at every phase.
  if(z>.071 && x>-.065 && x<.005 && y>.175 && y<.253)return 'pedal-left';
  // Tripo placed the second platform beside the rear derailleur instead of
  // on its crank. Reuse that imported platform at the correct opposite side.
  if(z<-.071 && x>.245 && x<.31 && y>.08 && y<.151)return 'pedal-right';
  if(z<-.021 && Math.hypot(x-.045,y-.164)<.057)return 'chainring';
  if(Math.abs(z)>.026 && x>-.055 && x<.067 && y>.137 && y<.248)return z>0?'crank-left':'crank-right';
  // Fork sides and the source hub attachments move with the front steering.
  if(x<-.19 && y>.177 && y<.476)return 'fork';
  return 'frame';
}

const PARTS=['frame','fork','wheel-front','wheel-rear','saddle','handlebar','crank-left','crank-right','chainring','pedal-left','pedal-right'];
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(n=>n/d);};
const sourceDirection=normal=>[-normal[2],normal[1],normal[0]];

function transformPart(name,x,y,z){
  const s=1.35,p=[-z*s,y*s,x*s];
  if(name==='frame')return compactBicycleFrame(x,y,z);
  if(name==='saddle'){
    const seat=BICYCLE_SOURCE.saddle;
    return [p[0],(y-seat[1])*s+BICYCLE_RIG.saddleTop[1],(x-seat[0])*s+BICYCLE_RIG.saddleTop[2]];
  }
  if(name==='handlebar'){
    // Preserve the drops, tape, brakes and all original handlebar surfaces.
    // A smooth bend brings the grips back toward the small rider's shoulders.
    const away=Math.min(1,Math.abs(z)/.11),blend=away*away*(3-2*away);
    p[0]*=.20/(.13*s);
    p[1]+=(.85-.522*s)*blend;
    p[2]+=(-.17+.315*s)*blend;
    return p;
  }
  if(name.startsWith('crank-')||name==='chainring'){
    const dx=(x-.045)*s,dy=(y-.164)*s;
    const r=Math.hypot(-.08,.054)*s,along=(dx*(-.08)+dy*.054)/Math.hypot(-.08,.054),across=(dx*.054+dy*.08)/Math.hypot(-.08,.054);
    const side=name==='crank-left'?-1:1;
    if(name==='chainring')return [p[0],.43+dy*.68,.04+dx*.68];
    return [side*Math.abs(p[0]),.43+across*.65,.04+side*along*.055/r];
  }
  if(name.startsWith('pedal-')){
    const side=name==='pedal-left'?-1:1;
    // The source pedals' contact faces are almost vertical. Rotate them into
    // horizontal platforms while retaining the imported shape and texture.
    const center=side<0?[-.035,.218,.102]:[.278,.113,-.102];
    return [side*.145-(z-center[2])*s, .43+(x-center[0])*s*.42, .04+side*.055+(y-center[1])*s];
  }
  return p;
}

export function authorBicycleNodes(document){
  const root=document.getRoot(),sourceNode=root.listNodes().find(n=>n.getMesh());
  if(!sourceNode||root.listMeshes().length!==1||sourceNode.getMesh().listPrimitives().length!==1)throw new Error('Bicycle authoring expects the owner-supplied, unsimplified single mesh.');
  const source=sourceNode.getMesh().listPrimitives()[0],position=source.getAttribute('POSITION').getArray(),indices=source.getIndices().getArray();
  const parts=Object.fromEntries(PARTS.map(p=>[p,[]]));
  for(let i=0;i<indices.length;i+=3)parts[classifyBicycleTriangle(position,indices[i],indices[i+1],indices[i+2])].push(indices[i],indices[i+1],indices[i+2]);
  if(Object.values(parts).reduce((s,p)=>s+p.length,0)!==indices.length||PARTS.some(name=>!parts[name].length))throw new Error('Each original bicycle triangle must survive in exactly one nonempty part: '+JSON.stringify(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,v.length]))));
  const frame=document.createNode('bicycle-source-frame').setExtras({bicycleRig:BICYCLE_RIG});
  const steering=document.createNode('bicycle-steering').setTranslation(BICYCLE_RIG.steeringPivot);
  const crank=document.createNode('bicycle-crank').setTranslation(BICYCLE_RIG.crankCenter);
  frame.addChild(steering).addChild(crank);
  const hierarchy={frame:{parent:frame,center:[0,0,0]},fork:{parent:steering,center:BICYCLE_RIG.steeringPivot},handlebar:{parent:steering,center:BICYCLE_RIG.steeringPivot},saddle:{parent:frame,center:[0,0,0]},'crank-left':{parent:crank,center:BICYCLE_RIG.crankCenter},'crank-right':{parent:crank,center:BICYCLE_RIG.crankCenter},chainring:{parent:crank,center:BICYCLE_RIG.crankCenter}};
  for(const end of ['front','rear']){
    const center=BICYCLE_RIG[end+'Axle'],parent=end==='front'?steering:frame,parentCenter=end==='front'?BICYCLE_RIG.steeringPivot:[0,0,0];
    const pivot=document.createNode(`bicycle-wheel-${end}`).setTranslation(center.map((v,i)=>v-parentCenter[i])).setExtras({role:'wheel-pivot',radius:BICYCLE_RIG.wheelRadius});
    parent.addChild(pivot);hierarchy['wheel-'+end]={parent:pivot,center};
  }
  for(const [side,sign] of [['left',-1],['right',1]]){
    const local=[sign*.145,0,sign*.055],center=local.map((v,i)=>v+BICYCLE_RIG.crankCenter[i]);
    const pedal=document.createNode(`bicycle-pedal-${side}`).setTranslation(local).setExtras({role:'pedal-platform'});
    pedal.addChild(document.createNode(`bicycle-pedal-contact-${side}`).setTranslation([0,.01,0]));
    crank.addChild(pedal);hierarchy['pedal-'+side]={parent:pedal,center};
  }
  frame.addChild(document.createNode('bicycle-saddle-top').setTranslation(BICYCLE_RIG.saddleTop));
  for(const side of ['left','right'])steering.addChild(document.createNode(`bicycle-grip-${side}`).setTranslation(BICYCLE_RIG.grips[side].map((v,i)=>v-BICYCLE_RIG.steeringPivot[i])));
  const buffer=root.listBuffers()[0];
  for(const name of PARTS){
    const partition=parts[name],{parent,center}=hierarchy[name],map=new Map(),oldVertices=[],newIndices=new Uint32Array(partition.length);
    partition.forEach((old,i)=>{if(!map.has(old)){map.set(old,map.size);oldVertices.push(old);}newIndices[i]=map.get(old);});
    const reflected=name==='crank-right'||name.startsWith('pedal-');
    if(reflected)for(let i=0;i<newIndices.length;i+=3){const b=newIndices[i+1];newIndices[i+1]=newIndices[i+2];newIndices[i+2]=b;}
    const primitive=document.createPrimitive().setMaterial(source.getMaterial());
    for(const semantic of source.listSemantics()){
      const original=source.getAttribute(semantic),components=original.getElementSize(),old=original.getArray(),out=new old.constructor(oldVertices.length*components);
      oldVertices.forEach((index,i)=>{
        let values=Array.from(old.subarray(index*components,index*components+components));
        if(semantic==='POSITION')values=transformPart(name,...values).map((v,k)=>v-center[k]);
        else if(semantic==='NORMAL'){
          // Jacobian transports source normals through the compact frame bend.
          // Tangent derivatives avoid flattening the imported tube shading.
          const px=position[index*3],py=position[index*3+1],pz=position[index*3+2];
          if(['frame','saddle','handlebar','crank-left','crank-right','chainring','pedal-left','pedal-right'].includes(name)){
            const n=values,t=Math.abs(n[1])<.9?normalize([n[2],0,-n[0]]):normalize([0,-n[2],n[1]]),u=[n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]],h=.00005;
            const a=transformPart(name,px+t[0]*h,py+t[1]*h,pz+t[2]*h),b=transformPart(name,px-t[0]*h,py-t[1]*h,pz-t[2]*h),c=transformPart(name,px+u[0]*h,py+u[1]*h,pz+u[2]*h),d=transformPart(name,px-u[0]*h,py-u[1]*h,pz-u[2]*h),v=a.map((x,j)=>x-b[j]),w=c.map((x,j)=>x-d[j]);
            values=normalize([v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]]);
            // Mirrored opposing crank and pedal flattening reverse handedness.
            // Flip winding and the transported normal together.
            if(reflected)values=values.map(v=>-v);
          }else values=sourceDirection(values);
        }
        values.forEach((value,j)=>out[i*components+j]=value);
      });
      primitive.setAttribute(semantic,document.createAccessor(`bicycle-${name}-${semantic}`).setType(original.getType()).setArray(out).setBuffer(buffer));
    }
    primitive.setIndices(document.createAccessor(`bicycle-${name}-indices`).setType('SCALAR').setArray(newIndices).setBuffer(buffer));
    parent.addChild(document.createNode(`bicycle-${name}-geometry`).setMesh(document.createMesh(`bicycle-${name}-mesh`).addPrimitive(primitive)).setExtras({sourceTriangles:partition.length/3}));
  }
  for(const scene of root.listScenes()){scene.removeChild(sourceNode);scene.addChild(frame);}
  sourceNode.dispose();
  const result={sourceTriangles:indices.length/3,retainedTriangles:Object.values(parts).reduce((s,p)=>s+p.length/3,0),parts:Object.fromEntries(Object.entries(parts).map(([id,p])=>[id,p.length/3]))};
  frame.setExtras({...frame.getExtras(),segmentation:result});
  return result;
}
