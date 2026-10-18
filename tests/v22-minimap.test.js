import test from 'node:test';
import assert from 'node:assert/strict';
import {islandMapGeometry,createMapProjection} from '../sources/core/minimap.js';
import {VoyageMinimap,mapRoadStyle,mapLegend} from '../sources/ui/minimap.js';

test('V22 map gives short visits a stronger line while retaining an optional scenic walking route',()=>{
 for(const scale of [.35,.7,1.5,3]){
  const visit=mapRoadStyle({short:true,scenic:false,width:2.2},scale,true),scenic=mapRoadStyle({short:false,scenic:true,width:3.2},scale,true);
  assert.ok(visit.width>=2.8&&visit.width>=scenic.width*1.8);assert.ok(visit.outline>0);assert.equal(scenic.outline,0);assert.notEqual(visit.color,scenic.color);
  const legacy=mapRoadStyle({short:true,scenic:true,width:3.2},scale,false),ordinary=mapRoadStyle({width:3.2},scale,false);assert.deepEqual(legacy,ordinary,'other islands retain their original road presentation');
 }
 assert.match(mapLegend('experience'),/Short visit/);assert.match(mapLegend('experience'),/Scenic walk/);assert.doesNotMatch(mapLegend('about'),/Scenic walk/);assert.match(mapLegend('about'),/Dock/);
});

test('V22 routes retain authored world positions and draw short visits after simple footprints without rotating the map',()=>{
 const island={id:'experience',x:40,z:-20,rotation:Math.PI/2,shore:[[-10,-10],[10,-10],[10,10],[-10,10]]},paths=[{id:'scenic-loop',width:3.2,scenic:true,points:[{x:0,z:0},{x:0,z:-5}]},{id:'visit-visionx',width:2.2,short:true,scenic:false,points:[{x:0,z:0},{x:4,z:0}]}];
 const geometry=islandMapGeometry(island,{paths}),projection=createMapProjection([{x:20,z:-40},{x:60,z:0}],200,180,10);
 assert.deepEqual(geometry.roads.map(road=>road.id),paths.map(path=>path.id));assert.equal(geometry.roads[1].short,true);
 assert.deepEqual(geometry.roads[1].points[0],{x:40,z:-20});assert.deepEqual(geometry.roads[1].points[1],{x:40,z:-24});
 const strokes=[],ctx={beginPath(){},moveTo(){},lineTo(){},closePath(){},setLineDash(){},fillText(){},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth});}};
 const map=new VoyageMinimap({clientHeight:180,getContext:()=>ctx},{});map.tag=()=>{};map.dot=()=>{};
 geometry.tracks=[{points:[],stops:[{id:'harbor',label:'H',x:40,z:-20}]}];geometry.careerLabels={key:[200,180,projection.scale,projection.bounds.minX,projection.bounds.minZ].join(':'),labels:[]};
 map.drawDetails(island,geometry,projection,200);
 const scenic=strokes.findIndex(stroke=>stroke.color===mapRoadStyle(paths[0],projection.scale,true).color),visit=strokes.findIndex(stroke=>stroke.color===mapRoadStyle(paths[1],projection.scale,true).color);
 assert.ok(scenic>=0&&visit>scenic,'short visits remain above the quieter scenic path');
 const origin=projection.project({x:40,z:-20}),north=projection.project({x:40,z:-21});assert.ok(north.y<origin.y);assert.equal(north.x,origin.x);
});
