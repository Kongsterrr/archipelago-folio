import test from 'node:test';
import assert from 'node:assert/strict';
import {VoyageMinimap} from '../sources/ui/minimap.js';

test('Experience map separates quay, court and station tiers while keeping roads and rails above them',t=>{
 const original=globalThis.Path2D;
 globalThis.Path2D=class{constructor(){this.starts=[];}moveTo(x,y){this.starts.push([x,y]);}lineTo(){}closePath(){}};
 t.after(()=>{if(original)globalThis.Path2D=original;else delete globalThis.Path2D;});
 const draws=[],ctx={fill(path){draws.push({kind:'fill',color:this.fillStyle,path});},stroke(){draws.push({kind:'stroke',color:this.strokeStyle});},beginPath(){},moveTo(){},lineTo(){},setLineDash(){}};
 const map=new VoyageMinimap({getContext:()=>ctx,clientHeight:200},{});
 const heights=[.85,1.49,1.5,2.4,4.19,4.2,5.8],geometry={campuses:[],parkingAreas:[],obstacles:[],landmarks:[],stations:[],districts:[],dock:[],terrain:heights.map((height,index)=>({height,points:[{x:index,z:0},{x:index+.5,z:0},{x:index,z:.5}]})),roads:[{width:2,points:[{x:0,z:0},{x:1,z:1}]}],tracks:[{points:[{x:0,z:2},{x:1,z:2}]}]};
 const projection={scale:1,project:({x,z})=>({x,y:z})};
 map.drawDetails({id:'experience'},geometry,projection,250);
 const fills=draws.filter(d=>d.kind==='fill');
 assert.equal(fills.length,3,'three physical terrace tiers have distinct fills');
 assert.deepEqual(fills.map(d=>d.path.starts.map(([x])=>x)),[[0,1],[2,3,4],[5,6]],'floor heights and sloped connectors use the intended tier thresholds');
 assert.equal(new Set(fills.map(d=>d.color)).size,3);
 assert.ok(fills.every(d=>d.color!=='#c7d7af'),'raised city surfaces remain distinct from the base lawn');
 assert.deepEqual(draws.slice(3).map(d=>d.color),['#fff3d5','#505969','#d6c4a5'],'roads and railway remain visible above terrace fills');
 const cached=geometry.mapPaths;draws.length=0;map.drawDetails({id:'experience'},geometry,projection,250);
 assert.equal(geometry.mapPaths,cached,'static terrain paths are reused on subsequent frames');
 draws.length=0;map.drawDetails({id:'projects'},geometry,projection,250);
 assert.notEqual(geometry.mapPaths,cached,'a different island style cannot reuse city terrace fills');
 assert.deepEqual(draws.filter(d=>d.kind==='fill').map(d=>d.color),['#c7d7af','#b8c797','#a3b384','#9eaa90','#969c91'],'Projects retains its Highlands palette');
});
