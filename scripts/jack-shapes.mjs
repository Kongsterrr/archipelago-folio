import * as THREE from 'three';

// Sample the authored cross-sections with a bounded cubic interpolation. Curved
// silhouettes are geometry, not a normal-map illusion on stacked primitives.
export function profileAt(profile,y){
 let i=0;while(i<profile.length-2&&y>profile[i+1][0])i++;
 const a=profile[i],b=profile[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
 return [y,...a.slice(1).map((_,k)=>{const n=k+1,p0=profile[Math.max(0,i-1)][n],p1=a[n],p2=b[n],p3=profile[Math.min(profile.length-1,i+2)][n];return THREE.MathUtils.clamp(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t),Math.min(p1,p2),Math.max(p1,p2));})];
}

// y, half width, front depth, back depth, depth center. Flattened temples,
// cheek volume and the narrower rounded chin are sculpted independently.
export const FACE_PROFILE=[
 [-.234,0,0,0,-.018],[-.228,.040,.036,.032,-.018],
 [-.211,.085,.077,.069,-.012],[-.181,.124,.117,.105,-.008],
 [-.139,.164,.145,.132,-.002],[-.090,.194,.161,.151,0],
 [-.035,.202,.170,.166,0],[.025,.197,.173,.168,.002],
 [.080,.188,.166,.163,.003],[.132,.163,.145,.144,.006],
 [.171,.110,.096,.096,.006],[.188,0,0,0,.006],
];
export function faceSurface(x,y,extra=0){
 const[,rx,front,,center]=profileAt(FACE_PROFILE,y),u=THREE.MathUtils.clamp(x/Math.max(rx,.001),-1,1);
 const edge=Math.sqrt(1-u*u),cheek=.004*Math.exp(-(((Math.abs(u)-.61)/.24)**2)-((y+.086)/.060)**2);
 return [x,y,center-front*Math.pow(edge,.84)-cheek*edge-extra];
}
export function loftGeometry(profile,{rows=28,radial=40,frontPower=1,warp}={}){
 const ps=[],ix=[],rings=[],min=profile[0][0],max=profile.at(-1)[0];
 for(let r=0;r<=rows;r++){
  const y=THREE.MathUtils.lerp(min,max,r/rows),[,rx,front,back,center=0]=profileAt(profile,y),pole=Math.max(rx,front,back)<1e-8,ring=[];
  for(let c=0;c<(pole?1:radial);c++){
   const a=c/radial*Math.PI*2,s=Math.sin(a),x=Math.cos(a)*rx;
   const p=[x,y,center+(s<0?-front*Math.pow(-s,frontPower):back*s)];
   ring.push(ps.length/3);ps.push(...(warp&&!pole?warp(p,r/rows,a):p));
  }rings.push(ring);
 }
 for(let r=0;r<rows;r++)for(let c=0;c<radial;c++){
  const lower=rings[r],upper=rings[r+1],next=(c+1)%radial;
  if(lower.length===1)ix.push(lower[0],upper[c],upper[next]);
  else if(upper.length===1)ix.push(lower[c],upper[0],lower[next]);
  else ix.push(lower[c],upper[c],lower[next],lower[next],upper[c],upper[next]);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function createFaceGeometry(){return loftGeometry(FACE_PROFILE,{rows:28,radial:40,frontPower:.84,warp:(p,t,a)=>Math.sin(a)<-1e-8?faceSurface(p[0],p[1]):p});}

export function createSneakerUpper(){
 return loftGeometry([
  [-.058,0,0,0,0],[-.055,.066,.127,.073,0],[-.037,.074,.135,.073,0],
  [-.012,.072,.121,.068,0],[.008,.063,.091,.064,0],
  [.029,.054,.045,.061,0],[.046,.046,.008,.058,0],
  [.058,.031,.020,.020,.037],[.061,0,0,0,.037],
 ],{rows:20,radial:28});
}
export function createFoldedCuff(rx,rz,height){
 return loftGeometry([
  [-height/2,rx*.89,rz*.89,rz*.89,0],[-height*.38,rx,rz,rz,0],
  [0,rx*1.025,rz*1.025,rz*1.025,0],[height*.38,rx,rz,rz,0],
  [height/2,rx*.90,rz*.90,rz*.90,0],
 ],{rows:8,radial:20});
}
