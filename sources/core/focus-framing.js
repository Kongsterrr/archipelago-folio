import {Vector3,MathUtils} from 'three';

export function campusReadingRect(width,height){
 if(width<=700)return {left:16,right:width-16,top:Math.min(96,height*.24),bottom:height*.44-16};
 return {left:24,right:width-Math.min(460,width*.95)-28,top:96,bottom:height-24};
}

// Closed-form perspective fit includes each corner's depth and the off-centre
// visible rectangle, rather than scaling a flat width/height approximation.
export function fitBoundsPose(bounds,{width,height,fov=28,azimuth=0,elevation=.66,near=.2,minDistance=0,rect=campusReadingRect(width,height)}){
 const {min,max}=bounds;
 const centre=new Vector3(...min).add(new Vector3(...max)).multiplyScalar(.5);
 const right=new Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
 const direction=new Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
 const up=new Vector3().crossVectors(direction,right),ty=Math.tan(MathUtils.degToRad(fov/2)),tx=ty*width/height;
 const left=2*rect.left/width-1,r=2*rect.right/width-1,b=1-2*rect.bottom/height,top=1-2*rect.top/height;
 const cx=(left+r)/2,cy=(b+top)/2,hx=(r-left)/2,hy=(top-b)/2;
 if(hx<=0||hy<=0)throw new Error('The landmark reading viewport must have positive area.');
 let distance=Math.max(minDistance,near);
 for(const x of[min[0],max[0]])for(const y of[min[1],max[1]])for(const z of[min[2],max[2]]){
  const q=new Vector3(x,y,z).sub(centre),a=q.dot(right),v=q.dot(up),depth=q.dot(direction);
  distance=Math.max(distance,depth+Math.abs(a+cx*tx*depth)/(hx*tx),depth+Math.abs(v+cy*ty*depth)/(hy*ty),depth+near+.05);
 }
 distance*=1.04;
 const target=centre.clone().addScaledVector(right,-cx*tx*distance).addScaledVector(up,-cy*ty*distance);
 return{target,position:target.clone().addScaledVector(direction,distance),distance};
}
