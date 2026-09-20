/** V4.4 concept-reference hairstyle. Metres, Head-local, facing -Z.
 * Broad overlapping sculpted locks form the silhouette; cap is coverage only.
 * Call addJackHair(THREE,part). Recommended hair material roughness: .49.
 */
export function addJackHair(THREE,part){
 const pieces=[];
 const colorBase=new THREE.Color('#50372b'),colorLight=new THREE.Color('#86604a'),colorDark=new THREE.Color('#33251f');
 const tint=(light,dark=0)=>colorBase.clone().lerp(colorLight,light).lerp(colorDark,dark).toArray();
 const mesh=(name,positions,indices,colors,uvs=null)=>{const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();pieces.push({geometry:g,colors,uvs});return g;};
 // A close-fitting, completely covered scalp preserves dark coverage under all
 // overlapping roots. The front edge stays behind the styled fringe.
 {
  const cols=48,rows=12,ps=[0,.204,.008],cs=[...tint(.02,.14)],ix=[];
  const index=(row,col)=>1+(row-1)*cols+(col+cols)%cols;
  for(let r=1;r<=rows;r++)for(let c=0;c<cols;c++){
   const phi=c/cols*Math.PI*2,front=Math.max(0,-Math.sin(phi)),back=Math.max(0,Math.sin(phi)),limit=1.80-1.04*Math.pow(front,.40)+.42*back,theta=limit*r/rows;
   ps.push(.224*Math.sin(theta)*Math.cos(phi),-.020+.224*Math.cos(theta),.008+.207*Math.sin(theta)*Math.sin(phi));cs.push(...tint(.015,.14));
  }
  for(let c=0;c<cols;c++)ix.push(0,index(1,c+1),index(1,c));
  for(let r=1;r<rows;r++)for(let c=0;c<cols;c++){const a=index(r,c),b=index(r,c+1),d=index(r+1,c),e=index(r+1,c+1);ix.push(a,b,d,b,e,d);}
  const inside=ps.length/3;for(let c=0;c<cols;c++){const i=index(rows,c)*3;ps.push(ps[i]*.94,(ps[i+1]+.023)*.94-.023,ps[i+2]*.94);cs.push(...tint(0,.18));}
  for(let c=0;c<cols;c++){const a=index(rows,c),b=index(rows,c+1),d=inside+c,e=inside+(c+1)%cols;ix.push(a,b,d,b,e,d);}
  const bottom=ps.length/3;ps.push(0,-.02,.008);cs.push(...tint(0,.18));for(let c=0;c<cols;c++)ix.push(inside+c,inside+(c+1)%cols,bottom);
  mesh('Jack_V44_HiddenScalp',ps,ix,cs);
 }
 // The outer surface is a wide flattened tear shape, not a round tube. Each
 // section has real shallow strand grooves in its outward face. Roots overlap
 // deeply and tips taper to one vertex, so no open rims or hollow cut ends show.
 const lock=(name,points,width,depth,{rows=23,sides=24,tip=1.15,phase=0,light=.05}={})=>{
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),ps=[],cs=[],ix=[],uvs=[.5,0];
  ps.push(...path.getPoint(0).toArray());cs.push(...tint(light,.08));
  for(let j=1;j<rows;j++){
   const t=j/rows,C=path.getPoint(t),T=path.getTangent(t).normalize();
   let N=new THREE.Vector3(C.x/.216**2,(C.y+.023)/.211**2,C.z/.198**2);N.addScaledVector(T,-N.dot(T)).normalize();
   if(N.lengthSq()<.5)N=new THREE.Vector3(0,1,0).addScaledVector(T,-T.y).normalize();
   const W=N.clone().cross(T).normalize();
   const broad=Math.pow(Math.sin(Math.PI*t),.68)*(1+.17*Math.sin(Math.PI*t)),taper=1-(.48*tip)*t*t;
   let rw=width*broad*taper,rd=depth*Math.pow(Math.sin(Math.PI*t),.57)*(1-.30*t);
   // The three large fringe locks finish in a soft elliptical cap. Keep their
   // generous cross-section until the last 15%, then close with a rounded pole
   // instead of a long triangular point; blend the transition without a seam.
   if(name.startsWith('Forelock')&&t>.85){
    const start=.85,q=(t-start)/(1-start),round=Math.sqrt(Math.max(0,1-q*q));
    const sw=width*Math.pow(Math.sin(Math.PI*start),.68)*(1+.17*Math.sin(Math.PI*start))*(1-(.48*tip)*start*start);
    const sd=depth*Math.pow(Math.sin(Math.PI*start),.57)*(1-.30*start);
    const blend=THREE.MathUtils.smoothstep(t,.85,.895);
    rw=THREE.MathUtils.lerp(rw,sw*round,blend);rd=THREE.MathUtils.lerp(rd,sd*round,blend);
   }
   for(let k=0;k<=sides;k++){
    uvs.push(k/sides,t);
    const a=k/sides*Math.PI*2,u=Math.cos(a),outer=Math.max(0,Math.sin(a));
    // Six long grooves flow with each tuft. Relief stays below 2.4mm and fades
    // toward root/tip; broad convex surfaces remain dominant at game distance.
    const strand=Math.cos((u+.032*Math.sin(t*Math.PI+phase))*Math.PI*5.1+phase),groove=Math.pow(Math.max(0,strand),8);
    const relief=-.0024*groove*outer**3*Math.sin(Math.PI*t)**.8;
    const p=C.clone().addScaledVector(W,u*rw).addScaledVector(N,Math.sin(a)*rd+relief);
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
 // Back locks are authored first. Broad forms follow the skull and remain under
 // the upper crown and front fringe, like the concept's swept layered haircut.
 lock('Back_Left',[[.01,.180,.073],[.111,.135,.166],[.157,.040,.190],[.143,-.056,.192],[.111,-.135,.166],[.065,-.194,.110]],.085,.024,{rows:22,sides:24,phase:.2});
 lock('Back_Center',[[.052,.190,.031],[.049,.143,.190],[.019,.051,.232],[.006,-.053,.231],[-.004,-.134,.207],[-.010,-.198,.115]],.092,.024,{rows:22,sides:24,phase:.7});
 lock('Back_Right',[[-.045,.183,.064],[-.126,.129,.170],[-.159,.025,.192],[-.146,-.069,.185],[-.112,-.139,.158],[-.067,-.194,.111]],.086,.025,{rows:22,sides:24,phase:1.1});
 lock('Crown_BackSweep',[[.101,.136,.118],[.061,.208,.109],[-.035,.220,.056],[-.163,.157,.050]],.079,.026,{rows:22,sides:24,light:.07,phase:.3});
 // Side panels overlap the cap at their roots and tuck behind the ears. Their
 // flattened width keeps them plush rather than cylindrical or rope-like.
 lock('Left_Side_Back',[[.104,.143,.085],[.199,.089,.087],[.226,-.010,.048],[.179,-.126,.070]],.061,.022,{rows:21,sides:20,phase:.5});
 lock('Right_Side_Back',[[-.110,.155,.082],[-.202,.094,.073],[-.225,-.021,.035],[-.174,-.122,.071]],.063,.022,{rows:21,sides:20,phase:1.0});
 lock('Left_Temple',[[.132,.145,-.058],[.202,.095,-.077],[.217,.008,-.074],[.192,-.063,-.067]],.055,.022,{rows:24,sides:40,phase:.9,tip:1.45});
 lock('Right_Temple',[[-.128,.160,-.040],[-.192,.120,-.075],[-.215,.034,-.078],[-.190,-.059,-.069]],.067,.025,{rows:24,sides:40,phase:.2,tip:1.45});
 // Three signature broad forelocks: lower fringe first, then a wide crown sweep
 // crossing above it. Curved tapered ends remain embedded in adjacent volumes.
 lock('Forelock_Lower',[[-.144,.149,-.073],[-.098,.151,-.168],[-.013,.109,-.204],[.069,.060,-.187]],.071,.03335,{rows:30,sides:64,phase:.4,light:.075,tip:1.40});
 lock('Forelock_Left',[[.051,.166,-.106],[.118,.128,-.150],[.183,.066,-.122],[.215,.032,-.070]],.070,.03105,{rows:30,sides:64,phase:.7,light:.06,tip:1.4});
 lock('Forelock_Main',[[-.158,.154,-.035],[-.085,.215,-.094],[.019,.189,-.160],[.121,.154,-.169],[.198,.171,-.096]],.084,.03910,{rows:30,sides:64,phase:1.0,light:.09,tip:1.55});
 // Lift at the crown completes the reference silhouette: a small soft curl,
 // attached at a broad base and tapering gently upward, never an isolated spike.
 lock('Crown_Curl',[[-.095,.185,.042],[-.153,.201,.029],[-.161,.236,.007],[-.142,.250,-.012]],.026,.018,{rows:18,sides:20,phase:.4,light:.04,tip:1.55});
 // Preserve the explicitly requested head-to-hair height independent of the
 // small curl's section thickness. This only compresses the crown above .15m.
 let top=-Infinity;for(const {geometry:g}of pieces){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)top=Math.max(top,a.getY(i));}
 for(const {geometry:g,colors,uvs}of pieces){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)if(a.getY(i)>.15)a.setY(i,.15+(a.getY(i)-.15)*(.253-.15)/(top-.15));g.computeVertexNormals();g.computeBoundingBox();g.userData={style:'V44_reference_sculpted_lock',recommendedRoughness:.49};part(g,'hair','Head',undefined,undefined,undefined,'#50372b');g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));if(uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));}
 return pieces.map(p=>p.geometry);
}
