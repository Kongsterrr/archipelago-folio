import test from 'node:test';
import assert from 'node:assert/strict';
import layouts from '../static/models/walk-layout.json' with {type:'json'};
import {islands} from '../sources/config.js';
import {createMapProjection} from '../sources/core/minimap.js';
import {VoyageMinimap,careerMapLabels} from '../sources/ui/minimap.js';

const island=islands.find(item=>item.id==='experience'),layout=layouts.islands.find(item=>item.id==='experience');
const measure=(text,size)=>text.length*size*.57;
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function fixture(width,height){
 const geometry=new VoyageMinimap({getContext:()=>({})},{}).geometryFor(island,layout),points=[...geometry.shore,...geometry.dock,...geometry.approach,island.dock];
 for(const p of geometry.dock)points.push({x:p.x-6,z:p.z-6},{x:p.x+6,z:p.z+6});
 return{geometry,projection:createMapProjection(points,width,height,width<190?15:21)};
}

for(const[width,height]of[[254,212],[274,230],[214,180],[166,142],[160,106],[122,104],[116,95]])test(`V20 north-up railway map has four readable captions at ${width}×${height}`,()=>{
 const{geometry,projection}=fixture(width,height),before=JSON.stringify(geometry),labels=careerMapLabels(geometry,projection,width,height,measure);
 assert.deepEqual(labels.map(label=>label.text).sort(),['1 VisionX','2 BeaconFire','3 Amtrak',width<140?'D':'Dock'].sort());
 assert.equal(JSON.stringify(geometry),before,'caption placement never changes the path or world coordinates');
 for(const label of labels){
  assert.ok(label.x>=3&&label.y>=3&&label.x+label.width<=width-3&&label.y+label.height<=height-3,`${label.text} is fully inside the canvas`);
  assert.ok(!overlap(label,{x:width-25,y:0,width:25,height:34}),'north compass remains clear');
  for(const berth of geometry.boatBerths){const p=projection.project(berth);assert.equal(overlap(label,{x:p.x-9,y:p.y-9,width:18,height:18}),false,'the parked boat cannot obscure its dock caption');}
  for(const other of labels)if(other!==label)assert.equal(overlap(label,other),false,`${label.text} overlaps ${other.text}`);
  for(const track of geometry.tracks){
   for(const stop of track.stops){const p=projection.project(stop);assert.equal(overlap(label,{x:p.x-7,y:p.y-7,width:14,height:14}),false,`${label.text} covers station ${stop.label}`);}
   for(const point of track.points){const p=projection.project(point);assert.ok(!(p.x>=label.x&&p.x<=label.x+label.width&&p.y>=label.y&&p.y<=label.y+label.height),`${label.text} covers the shared railway route`);}
  }
 }
 const origin=projection.project(island),north=projection.project({x:island.x,z:island.z-1}),east=projection.project({x:island.x+1,z:island.z});
 assert.ok(north.y<origin.y);assert.equal(north.x,origin.x);assert.ok(east.x>origin.x);assert.equal(east.y,origin.y);
});

test('V20 map draws one set of numbered platforms and reuses its caption layout',t=>{
 const oldPath=globalThis.Path2D;globalThis.Path2D=class{moveTo(){}lineTo(){}closePath(){}};t.after(()=>{if(oldPath)globalThis.Path2D=oldPath;else delete globalThis.Path2D;});
 const text=[],dots=[],ctx={font:'',beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},roundRect(){},setLineDash(){},fillText(value){text.push(value);},measureText(value){return{width:measure(value,Number.parseFloat(this.font.split(' ')[1]))};}};
 const width=254,height=212,map=new VoyageMinimap({clientHeight:height,getContext:()=>ctx},{}),{geometry,projection}=fixture(width,height);
 map.dot=(point,r)=>dots.push({point,r});map.drawDetails(island,geometry,projection,width);
 assert.deepEqual(text.filter(value=>['H','1','2','3'].includes(value)),['H','1','2','3']);assert.equal(dots.length,4,'nearby reader and action dots cannot obscure platform numbers');
 assert.deepEqual(text.filter(value=>!['H','1','2','3'].includes(value)).sort(),['1 VisionX','2 BeaconFire','3 Amtrak','Dock'].sort());
 const cached=geometry.careerLabels;map.drawDetails(island,geometry,projection,width);assert.equal(geometry.careerLabels,cached,'the label search is not repeated each animation frame');
});
