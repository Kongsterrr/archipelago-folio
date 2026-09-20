/** Original fine-strand tangent-space normals. Pure JS, no DOM/Node/Three APIs.
 * U crosses each lock; V follows it. Treat as linear data, repeat U, and assign
 * with normalScale .25 initially. The top/bottom two rows are exactly neutral,
 * so UV(0,0) is safe for scalp/brow geometry without strand UVs.
 */
export const HAIR_NORMAL_SPEC=Object.freeze({width:128,height:256,strandsAcrossU:30,maxTangentStrength:.135,colorSpace:'linear',recommendedNormalScale:.25,neutralBorderRows:2});
const mod=(value,period)=>((value%period)+period)%period;
const amplitude=i=>.83+.17*Math.sin(i*2.399963229728653)+.06*Math.cos(i*1.718281828459045);
const smoothstep=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export function createHairNormalData(){
 const {width,height,strandsAcrossU}=HAIR_NORMAL_SPEC,data=new Uint8Array(width*height*4),TAU=Math.PI*2;
 for(let y=0;y<height;y++){
  const v=(y+.5)/height,borderDistance=Math.min(y,height-1-y),fade=smoothstep(borderDistance,1,5);
  // A subpixel sideways bend gives the predominantly longitudinal highlights
  // a gentle flow. The underlying field is periodic at both UV seams.
  const bend=.0042*Math.sin(TAU*v)+.0013*Math.sin(2*TAU*v);
  const bendSlope=.0042*TAU*Math.cos(TAU*v)+.0026*TAU*Math.cos(2*TAU*v);
  for(let x=0;x<width;x++){
   const offset=(y*width+x)*4;data[offset+3]=255;
   if(fade===0){data[offset]=128;data[offset+1]=128;data[offset+2]=255;continue;}
   const u=(x+.5)/width,coordinate=mod((u+bend)*strandsAcrossU,strandsAcrossU),strand=Math.floor(coordinate),t=coordinate-strand;
   // Thirty subtly varied grooves. Each reaches a zero tangent at its edge;
   // no random discontinuities or independent per-pixel noise are introduced.
   const primary=amplitude(strand)*Math.sin(TAU*t),secondary=.11*Math.sin(TAU*t*2)*Math.sin(Math.PI*t)**2;
   let nx=-(primary+secondary)*.112*fade,ny=nx*bendSlope;
   const magnitude=Math.hypot(nx,ny),limit=HAIR_NORMAL_SPEC.maxTangentStrength;if(magnitude>limit){nx*=limit/magnitude;ny*=limit/magnitude;}
   const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
   data[offset]=Math.round((nx*.5+.5)*255);data[offset+1]=Math.round((ny*.5+.5)*255);data[offset+2]=Math.round((nz*.5+.5)*255);
  }
 }
 return {data,width,height};
}
