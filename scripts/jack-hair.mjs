/** V8 reference-inspired textured crop. Metres, Head-local, facing -Z.
 * A short tapered nape/cap underlies three plush crown locks and three forward fringe locks.
 * Call addJackHair(THREE,part). Recommended hair material roughness: .49.
 */
export function addJackHair(THREE,part){
 const pieces=[];
 const capRadius={x:.212,y:.216,z:.195};
 const colorBase=new THREE.Color('#412b21'),colorLight=new THREE.Color('#865d43'),colorDark=new THREE.Color('#211611');
 const tint=(light,dark=0)=>colorBase.clone().lerp(colorLight,light).lerp(colorDark,dark).toArray();
 const mesh=(name,positions,indices,colors,uvs=null)=>{const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();pieces.push({geometry:g,colors,uvs});return g;};
 // The sides finish above the ears and the nape follows the upper rear skull.
 // A high front hairline leaves the forehead visible below the lifted tips.
 // Short shallow flutes give the taper texture without adding temple curtains.
 {
  const cols=48,rows=16,ps=[0,.207,.008],cs=[...tint(.08,.03)],ix=[];
  const index=(row,col)=>1+(row-1)*cols+(col+cols)%cols;
  for(let r=1;r<=rows;r++)for(let c=0;c<cols;c++){
   const phi=c/cols*Math.PI*2,front=Math.max(0,-Math.sin(phi)),back=Math.max(0,Math.sin(phi)),limit=1.56-.87*Math.pow(front,.55)+.60*back+.016*Math.cos(phi*7),theta=limit*r/rows;
    const flow=phi+.08*Math.cos(theta),ridge=(.0028*Math.cos(flow*13)+.0007*Math.cos(flow*29))*Math.sin(theta)**2;
   const x=(capRadius.x+ridge)*Math.sin(theta)*Math.cos(phi),z=.008+(capRadius.z+ridge)*Math.sin(theta)*Math.sin(phi);
   const rootFill=.007*Math.exp(-((x/.145)**2)-(((z-.012)/.13)**2))*Math.max(0,Math.cos(theta));
   ps.push(x,-.020+capRadius.y*Math.cos(theta)+rootFill,z);cs.push(...tint(.07+.015*Math.cos(flow*17),.035));
  }
  for(let c=0;c<cols;c++)ix.push(0,index(1,c+1),index(1,c));
  for(let r=1;r<rows;r++)for(let c=0;c<cols;c++){const a=index(r,c),b=index(r,c+1),d=index(r+1,c),e=index(r+1,c+1);ix.push(a,b,d,b,e,d);}
  const inside=ps.length/3;for(let c=0;c<cols;c++){const i=index(rows,c)*3;ps.push(ps[i]*.94,(ps[i+1]+.023)*.94-.023,ps[i+2]*.94);cs.push(...tint(0,.18));}
  for(let c=0;c<cols;c++){const a=index(rows,c),b=index(rows,c+1),d=inside+c,e=inside+(c+1)%cols;ix.push(a,b,d,b,e,d);}
  const bottom=ps.length/3;ps.push(0,-.02,.008);cs.push(...tint(0,.18));for(let c=0;c<cols;c++)ix.push(inside+c,inside+(c+1)%cols,bottom);
  mesh('Jack_V7_TaperedCoverage',ps,ix,cs).userData.coverage={columns:cols,rows,tapered:true,radius:capRadius};
 }
 // The outer surface is a wide flattened tear shape, not a round tube. Each
 // section has real shallow strand grooves in its outward face. Roots overlap
 // deeply and tips taper to one vertex, so no open rims or hollow cut ends show.
 const lock=(name,points,width,depth,{rows=20,sides=24,tip=1.15,phase=0,light=.05,embed=.020}={})=>{
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),ps=[],cs=[],ix=[],uvs=[.5,0];
  ps.push(...path.getPoint(0).toArray());cs.push(...tint(light,.08));
  for(let j=1;j<rows;j++){
   const t=j/rows,C=path.getPoint(t),T=path.getTangent(t).normalize();
   let N=new THREE.Vector3(C.x/.216**2,(C.y+.023)/.211**2,C.z/.198**2);N.addScaledVector(T,-N.dot(T)).normalize();
   if(N.lengthSq()<.5)N=new THREE.Vector3(0,1,0).addScaledVector(T,-T.y).normalize();
   const W=N.clone().cross(T).normalize();
   const broad=Math.pow(Math.sin(Math.PI*t),.68)*(1+.17*Math.sin(Math.PI*t)),taper=1-(.48*tip)*t*t;
   let rw=width*broad*taper,rd=depth*Math.pow(Math.sin(Math.PI*t),.57)*(1-.30*t);
   // Narrow gradually over the last third. This leaves a rounded wedge tip
   // instead of the old wide elliptical cap, which read as a blunt cut block.
   const finish=1-.65*THREE.MathUtils.smoothstep(t,.80,1);
   rw*=finish;rd*=finish;
   for(let k=0;k<=sides;k++){
    uvs.push(k/sides,t);
    const a=k/sides*Math.PI*2,u=Math.cos(a),outer=Math.max(0,Math.sin(a));
    // Six long grooves flow with each tuft. Relief stays below 2.4mm and fades
    // toward root/tip; broad convex surfaces remain dominant at game distance.
    const strand=Math.cos((u+.032*Math.sin(t*Math.PI+phase))*Math.PI*5.1+phase),groove=Math.pow(Math.max(0,strand),8);
    const relief=-.0030*groove*outer**3*Math.sin(Math.PI*t)**.8;
    // An asymmetric deep root/underside embeds each lock into the cap. Surface
    // relief remains small, but no thin crescent of sky separates tuft and scalp.
    const underside=-embed*Math.max(0,-Math.sin(a))**2*Math.sin(Math.PI*t)**.55;
    const p=C.clone().addScaledVector(W,u*rw).addScaledVector(N,Math.sin(a)*rd+relief+underside);
    // The inner vertices near the root reach under the scalp even
    // where a lifted fringe's tangent turns upward. The short free tips retain
    // their convex lens section instead of being stretched into flat sheets.
    const inner=Math.max(0,-Math.sin(a))**2*(1-THREE.MathUtils.smoothstep(t,.48,.78));
    const radius=Math.hypot(p.x/capRadius.x,(p.y+.020)/capRadius.y,(p.z-.008)/capRadius.z);
    if(radius>.975&&inner>0){const target=p.clone().sub(new THREE.Vector3(0,-.020,.008)).multiplyScalar(.975/radius).add(new THREE.Vector3(0,-.020,.008));p.lerp(target,inner);}
    ps.push(...p.toArray());cs.push(...tint(light+.23*outer+.17*Math.max(0,-strand)*outer,groove*outer*.32+(1-outer)*.055));
   }
  }
  const end=ps.length/3;uvs.push(.5,1);ps.push(...path.getPoint(1).toArray());cs.push(...tint(light,.10));
  const ring=(j,k)=>1+(j-1)*(sides+1)+k;
  // Frame W × N follows T, so this winding points away from the centerline.
  for(let k=0;k<sides;k++)ix.push(0,ring(1,k+1),ring(1,k));
  for(let j=1;j<rows-1;j++)for(let k=0;k<sides;k++){const a=ring(j,k),b=ring(j,k+1),c=ring(j+1,k),d=ring(j+1,k+1);ix.push(a,b,c,b,d,c);}
  for(let k=0;k<sides;k++)ix.push(ring(rows-1,k),ring(rows-1,k+1),end);
  mesh(name,ps,ix,cs,uvs);
 };
 // Broad, overlapping crown locks flow toward the brow on slightly different
 // diagonals. The chunky volumes and long shallow grooves echo the supplied
 // figure without importing its static mesh or texture atlas.
 lock('Crop_Crown_Left',[[-.112,.132,.104],[-.115,.193,.038],[-.102,.218,-.038],[-.074,.199,-.130]],.069,.032,{phase:.9,light:.075,tip:.94,embed:.024});
 lock('Crop_Crown_Center',[[.012,.138,.124],[.018,.220,.050],[.030,.237,-.034],[.022,.212,-.139]],.078,.036,{phase:.2,light:.13,tip:.88,embed:.026});
 lock('Crop_Crown_Right',[[.119,.130,.094],[.125,.190,.030],[.104,.220,-.042],[.077,.195,-.126]],.068,.032,{phase:.6,light:.10,tip:1.00,embed:.024});
 // Three soft forelocks sweep toward the forehead and settle above the brows.
 // Their short, staggered tips keep the face open and avoid a bowl-cut edge.
 lock('Crop_Fringe_Left',[[-.137,.166,.023],[-.143,.183,-.045],[-.137,.117,-.111],[-.109,.078,-.177]],.064,.031,{phase:.4,light:.16,tip:.86,embed:.028});
 lock('Crop_Fringe_Center',[[-.039,.182,.030],[-.020,.210,-.043],[.003,.130,-.117],[.024,.070,-.190]],.076,.035,{phase:1.0,light:.19,tip:.82,embed:.030});
 lock('Crop_Fringe_Right',[[.091,.164,.026],[.130,.192,-.040],[.136,.128,-.108],[.151,.088,-.173]],.064,.031,{phase:.7,light:.12,tip:.90,embed:.028});
 // Preserve Jack's authored height and helm/seat calibration while making
 // the crown fuller and the forward fringe visibly layered.
 let top=-Infinity;for(const {geometry:g}of pieces){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)top=Math.max(top,a.getY(i));}
 for(const [pieceIndex,{geometry:g,colors,uvs}]of pieces.entries()){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)if(a.getY(i)>.15)a.setY(i,.15+(a.getY(i)-.15)*(.253-.15)/(top-.15));g.computeVertexNormals();g.computeBoundingBox();g.userData={...g.userData,style:'V8_reference_textured_tousled_crop',recommendedRoughness:.49};part(g,'hair','Head',undefined,undefined,undefined,'#412b21');g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));if(uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  // UV1 is a non-overlapping 4x3 authoring atlas for the actual Blender bake.
  // Cell zero is reserved for the brows; the scalp and six locks use 1..7.
  const uv=g.getAttribute('uv'),atlas=[],cell=pieceIndex+1,col=cell%4,row=Math.floor(cell/4),pad=.018;
  for(let i=0;i<uv.count;i++)atlas.push((col+pad+uv.getX(i)*(1-pad*2))/4,(row+pad+uv.getY(i)*(1-pad*2))/3);
  g.setAttribute('uv1',new THREE.Float32BufferAttribute(atlas,2));g.userData.bakeCell=cell;
 }

 return pieces.map(p=>p.geometry);
}
