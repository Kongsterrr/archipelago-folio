/** V4.3 original soft short haircut. One closed mesh; metres, Head-local, -Z front.
 * Integration: replace the old hair cap / lock block with addJackHair(THREE, part).
 * Keep the existing crown normalization to 1.30m. Suggested hair roughness: .72.
 * No separate strands, overlay strips, tubes, texture assets or color bands.
 */
export function addJackHair(THREE, part) {
 const columns=96,rows=22,positions=[],indices=[],tints=[];
 const gaussian=(v,width)=>Math.exp(-Math.pow(v/width,2));
 const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
 const ringIndex=(row,column)=>1+(row-1)*columns+(column+columns)%columns;
 const limitAt=phi=>{
  const front=Math.max(0,-Math.sin(phi)),back=Math.max(0,Math.sin(phi));
  const sideburn=.19*(gaussian(wrap(phi+.18),.13)+gaussian(wrap(phi+Math.PI-.18),.13));
  const sideLimit=1.66-.50*front+.30*back+sideburn;
  const signed=wrap(phi+Math.PI/2)-Math.PI/2;
  // Three broad scallops merge into one side-swept fringe. The longest is on
  // model-left (viewer-right); the opposite side rises into the visible part.
  const fringeY=.150-.076*gaussian(signed+1.99,.23)-.044*gaussian(signed+1.54,.21)-.021*gaussian(signed+1.14,.16)+.025*gaussian(signed+.94,.14);
  const frontLimit=Math.acos((Math.max(.067,fringeY)-.006)/.289);
  return THREE.MathUtils.lerp(sideLimit,frontLimit,THREE.MathUtils.smoothstep(front,.57,.83));
 };
 const scalp=(theta,phi)=>{
  const st=Math.sin(theta),ct=Math.cos(theta),cp=Math.cos(phi),sp=Math.sin(phi);
  const front=THREE.MathUtils.smoothstep(-sp,.04,.62);
  const edgeFade=THREE.MathUtils.smoothstep(limitAt(phi)-theta,0,.13);
  const envelope=front*Math.pow(st,.80)*THREE.MathUtils.smoothstep(ct,-.11,.40)*edgeFade;
  // Raised broad locks and recessed channels are sculpted into this cap's
  // surface. Their 6–12mm relief stays continuous all the way through the sweep.
  const sweep=theta+.37*cp+.065*Math.sin(phi*2);
  const ridges=.010*gaussian(sweep-.52,.16)+.012*gaussian(sweep-.85,.145)+.010*gaussian(sweep-1.17,.14);
  const grooves=.007*gaussian(sweep-.68,.072)+.007*gaussian(sweep-1.01,.072);
  const partAngle=-.94-.34*(1-theta/1.40);
  const partMask=gaussian(wrap(phi-partAngle),.125)*THREE.MathUtils.smoothstep(theta,.13,.40)*edgeFade;
  const bulk=.014*gaussian(theta-.72,.48)*gaussian(wrap(phi+1.92),.78);
  const relief=envelope*(ridges-grooves)-.009*partMask+bulk*Math.pow(st,1.4);
  const tint=new THREE.Color('#3b2c24').lerp(new THREE.Color('#574035'),Math.min(.40,ridges/.022*envelope*.40));
  tint.lerp(new THREE.Color('#211a17'),Math.min(.52,partMask*.48+grooves/.014*envelope*.20));
  tints.push(...tint.toArray());
  const n=new THREE.Vector3(st*cp/.262,ct/.289,st*sp/.233).normalize();
  return new THREE.Vector3(.262*st*cp+.006*gaussian(theta,.55),.006+.289*ct,.011+.233*st*sp).addScaledVector(n,relief);
 };
 positions.push(.006,.295,.011);tints.push(...new THREE.Color('#3b2c24').toArray()); // One welded crown vertex: no pole degeneracy.
 for(let row=1;row<=rows;row++)for(let col=0;col<columns;col++){
  const phi=col/columns*Math.PI*2,theta=limitAt(phi)*Math.pow(row/rows,.82);
  positions.push(...scalp(theta,phi).toArray());
 }
 // All outer triangles wind outward; the ring wraps without duplicated seams.
 for(let col=0;col<columns;col++)indices.push(0,ringIndex(1,col+1),ringIndex(1,col));
 for(let row=1;row<rows;row++)for(let col=0;col<columns;col++){
  const a=ringIndex(row,col),b=ringIndex(row,col+1),c=ringIndex(row+1,col),d=ringIndex(row+1,col+1);
  indices.push(a,b,c,b,d,c);
 }
 // Roll the hairline into the skull with a 5% inset. This produces a softly
 // rounded, solid edge instead of an open cutout or a floating rim.
 const innerStart=positions.length/3;
 for(let col=0;col<columns;col++){
  const p=new THREE.Vector3().fromArray(positions,ringIndex(rows,col)*3);
  positions.push(p.x*.95,(p.y+.015)*.95-.015,p.z*.95);tints.push(...new THREE.Color('#35271f').toArray());
 }
 for(let col=0;col<columns;col++){
  const a=ringIndex(rows,col),b=ringIndex(rows,col+1),c=innerStart+col,d=innerStart+(col+1)%columns;
  indices.push(a,b,c,b,d,c);
 }
 // Hidden inside the head. This closed underside also makes topology testable.
 const bottom=positions.length/3;positions.push(0,.015,.011);tints.push(...new THREE.Color('#35271f').toArray());
 for(let col=0;col<columns;col++)indices.push(innerStart+col,innerStart+(col+1)%columns,bottom);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
 geometry.name='Jack_V43_ContinuousSweptHair';
 geometry.userData={design:'Continuous rounded short haircut with shallow sculpted sweep',triangles:indices.length/3,recommendedRoughness:.72};
 part(geometry,'hair','Head',undefined,undefined,undefined,'#3b2c24');
 // part() supplies skin weights and replaces colors; restore this continuous
 // restrained color field afterward so the side part reads at game distance.
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
 return geometry;
}
