import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addJackHair} from '../scripts/jack-hair.mjs';

// Inspect the authored surfaces before the unchanged Head transform / export.
// The production part callback supplies the same generic cylindrical UV0 when
// a handmade cap has none. addJackHair supplies each lock's longitudinal chart.
const pieces=addJackHair(THREE,(g)=>{
 if(g.hasAttribute('uv'))return;
 g.computeBoundingBox();const p=g.getAttribute('position'),uv=[];
 for(let i=0;i<p.count;i++)uv.push(.5+Math.atan2(p.getX(i),p.getZ(i))/(Math.PI*2),(p.getY(i)-g.boundingBox.min.y)/(g.boundingBox.max.y-g.boundingBox.min.y));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
});

test('V7 crop keeps seven isolated bake cells and lowers hair triangle cost',()=>{
 assert.equal(pieces.length,7);
 assert.ok(pieces.reduce((n,g)=>n+g.index.count/3,0)<=7200);
 for(const [i,g]of pieces.entries()){
  const uv=g.getAttribute('uv1'),cell=i+1,col=cell%4,row=Math.floor(cell/4);
  assert.equal(g.userData.bakeCell,cell);
  for(let j=0;j<uv.count;j++){
   assert.ok(uv.getX(j)>col/4&&uv.getX(j)<(col+1)/4);
   assert.ok(uv.getY(j)>row/3&&uv.getY(j)<(row+1)/3);
  }
 }
});

test('V7 crown and fringe point forward without a side part or long forehead curtain',()=>{
 let top=-Infinity;
 for(const g of pieces){g.computeBoundingBox();top=Math.max(top,g.boundingBox.max.y);}
 assert.ok(Math.abs(top-.253)<1e-6,'existing hair height is retained');
 for(const g of pieces.slice(1)){
  const p=g.getAttribute('position'),last=p.count-1;
  assert.ok(p.getZ(last)<p.getZ(0)-.10,`${g.name}: runs forward toward -Z`);
  assert.ok(Math.abs(p.getX(last)-p.getX(0))<.050,`${g.name}: no lateral comb-over`);
  let visibleBottom=Infinity;
  for(let row=6;row<20;row++)for(let col=0;col<=12;col++)visibleBottom=Math.min(visibleBottom,p.getY(1+(row-1)*25+col));
  assert.ok(visibleBottom>.115,`${g.name}: outer locks remain above the forehead`);
 }
 for(const g of pieces.slice(4)){
  const p=g.getAttribute('position'),last=p.count-1;
  assert.ok(p.getY(last)>p.getY(0)+.02,`${g.name}: front tip lifts modestly`);
  assert.ok(p.getZ(last)<-.13,`${g.name}: front tip projects beyond the cap`);
  assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>.060,'tufts have chunky width');
  const backCrown=Math.max(...pieces.slice(0,4).map(piece=>piece.boundingBox.max.y));
  assert.ok(p.getY(last)>backCrown-.012&&p.getY(last)<backCrown+.035,`${g.name}: compact tips stay near the textured crown, not tall cones`);
  assert.ok(p.getZ(0)-p.getZ(last)>(p.getY(last)-p.getY(0))*1.2,`${g.name}: mostly forward with only a short upward lift`);
 }
});

test('V7 crop undersides stay embedded in the scalp through their roots',()=>{
 // A detached lock can still have a plausible bounding box. Sample the real
 // inner surface of each loft section against the covered skull envelope.
 const {radius}=pieces[0].userData.coverage;
 for(const g of pieces.slice(1)){
  const p=g.getAttribute('position');
  for(let row=1;row<=9;row++){
   let nearest=Infinity;
   for(let col=0;col<=24;col++){
    const i=1+(row-1)*25+col;
    nearest=Math.min(nearest,Math.hypot(p.getX(i)/radius.x,(p.getY(i)+.020)/radius.y,(p.getZ(i)-.008)/radius.z));
   }
   assert.ok(nearest<1.01,`${g.name} section ${row}: no floating scalp gap (${nearest})`);
  }
 }
});

test('V7 scalp has short sides and a high exposed forehead edge',()=>{
 const cap=pieces[0],p=cap.getAttribute('position'),{columns,rows}=cap.userData.coverage;
 const outer=(c)=>1+(rows-1)*columns+c;
 assert.ok(p.getY(outer(0))>-.03&&p.getY(outer(columns/2))>-.03,'temple edge stays above ears');
 assert.ok(p.getY(outer(columns*3/4))>.14,'front hairline exposes the forehead');
 assert.ok(p.getY(outer(columns/4))>-.16,'nape finishes above the old long back hair');
 assert.equal(cap.userData.coverage.tapered,true);
});

test('V7 hair surfaces contain finite normals and non-degenerate triangles',()=>{
 for(const g of pieces){
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),ix=g.index;
  for(let i=0;i<p.count;i++){
   const normal=new THREE.Vector3().fromBufferAttribute(n,i);
   assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
   assert.ok(Math.abs(normal.length()-1)<1e-5,`${g.name}: normal ${i}`);
  }
  for(let i=0;i<ix.count;i+=3){
   const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+2));
   assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-18,`${g.name}: degenerate triangle`);
  }
 }
});
