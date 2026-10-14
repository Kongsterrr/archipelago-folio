import {createMapProjection,islandMapGeometry,selectMapIsland} from '../core/minimap.js';

const NAMES={about:'Jack Kong',experience:'Experience',projects:'Projects',education:'Education',harbor:'Meet Jack',connect:'Connect',amtrak:'Amtrak',beaconfire:'BeaconFire',visionx:'VisionX',affirmation:'Affirmation',research:'Research',catering:'Catering',learning:'Education'};
const INK='#244d59',PAPER='#fffbef',ORANGE='#ed7541';
const TERRAIN_COLORS=['#c7d7af','#b8c797','#a3b384','#9eaa90','#969c91'];
const EXPERIENCE_TERRACE_COLORS=['#dfd3b6','#c5c9a4','#b4b995','#b3ab96','#98998e'];

export const careerTerrainBand=height=>height<4?0:height<11?1:height<18?2:height<26?3:4;
export const trainMapHeading=train=>(train.yaw||0)+(train.direction<0?Math.PI:0);

// Keep the mountain railway's labels outside its route and numbered platforms.
// World geometry remains north-up; only these screen-space captions move.
export function careerMapLabels(g,projection,w,h,measure){
 const size=w<190?8:9,height=size+7,stops=g.tracks.flatMap(track=>track.stops||[]),route=g.tracks.flatMap(track=>track.points.map(p=>projection.project(p)));
 const blockers=stops.map(stop=>{const p=projection.project(stop);return{x:p.x-7,y:p.y-7,width:14,height:14};});
 for(const berth of g.boatBerths||[]){const p=projection.project(berth);blockers.push({x:p.x-9,y:p.y-9,width:18,height:18});}
 blockers.push({x:w-25,y:0,width:25,height:34});
 const labels=stops.filter(stop=>stop.id!=='harbor').map(stop=>({id:stop.id,text:`${stop.label} ${NAMES[stop.id]||stop.id}`,anchor:projection.project(g.districts.find(d=>d.id===stop.id)||stop)}));
 if(g.dock.length){const anchor=projection.project({x:g.dock.reduce((sum,p)=>sum+p.x,0)/g.dock.length,z:g.dock.reduce((sum,p)=>sum+p.z,0)/g.dock.length});labels.push({id:'dock',text:w<140?'D':'Dock',anchor:{x:anchor.x,y:anchor.y+12}});}
 const overlap=(a,b)=>a.x<b.x+b.width+2&&a.x+a.width+2>b.x&&a.y<b.y+b.height+2&&a.y+a.height+2>b.y;
 const cols=Math.ceil(w),rows=Math.ceil(h),blocked=new Uint8Array(cols*rows),prefix=new Uint32Array((cols+1)*(rows+1));
 const mark=(x,y,width,height)=>{const x0=Math.max(0,Math.floor(x)),x1=Math.min(cols,Math.ceil(x+width));for(let row=Math.max(0,Math.floor(y));row<Math.min(rows,Math.ceil(y+height));row++)blocked.fill(1,row*cols+x0,row*cols+x1);};
 for(const box of blockers)mark(box.x-2,box.y-2,box.width+4,box.height+4);
 const routeMargin=w<140?5:9;
 for(const p of route)mark(p.x-routeMargin,p.y-routeMargin,routeMargin*2,routeMargin*2);
 for(let y=1;y<=rows;y++){let sum=0;for(let x=1;x<=cols;x++){sum+=blocked[(y-1)*cols+x-1];prefix[y*(cols+1)+x]=prefix[(y-1)*(cols+1)+x]+sum;}}
 const occupied=(x,y,width,height)=>{const x0=Math.floor(x),x1=Math.ceil(x+width),y0=Math.floor(y),y1=Math.ceil(y+height),stride=cols+1;return prefix[y1*stride+x1]-prefix[y0*stride+x1]-prefix[y1*stride+x0]+prefix[y0*stride+x0]>0;};
 const options=[];
 for(const label of labels.sort((a,b)=>measure(b.text,size)-measure(a.text,size))){
  const width=measure(label.text,size)+8,candidates=[];
  for(let y=3;y<=h-height-3;y+=3)for(let x=3;x<=w-width-3;x+=3){
   if(occupied(x,y,width,height))continue;
   const cx=x+width/2,cy=y+height/2,cost=(cx-label.anchor.x)**2+(cy-label.anchor.y)**2;
   candidates.push({id:label.id,text:label.text,x,y,width,height,cx,cy,size,cost});
  }
  options.push(candidates.sort((a,b)=>a.cost-b.cost));
 }
 // Three company names and one dock caption are small enough to solve jointly;
 // a greedy placement can strand Amtrak on the smallest portrait map.
 const place=(index,result)=>{
  if(index===options.length)return result;
  for(const candidate of options[index])if(!result.some(box=>overlap(candidate,box))){const fit=place(index+1,[...result,candidate]);if(fit)return fit;}
  return null;
 };
 return place(0,[])||[];
}

// Canvas coordinates are CSS pixels; backing pixels follow the display density.
// All map geometry comes from the same island/walk data as the playable world.
export class VoyageMinimap {
 constructor(canvas,{islands,challenges,gates,lamps,worldRadius,title,mode,button,legend}){
  Object.assign(this,{canvas,islands,challenges,gates,lamps,worldRadius,title,mode,button,legend});
  this.ctx=canvas.getContext('2d');this.geometry=new Map();this.island=null;
 }
 geometryFor(island,layout){
  const cached=this.geometry.get(island.id);
  if(cached?.layout===layout)return cached.value;
  const value=islandMapGeometry(island,layout);
  if(island.id==='experience'&&layout?.railway){const c=Math.cos(island.rotation||0),s=Math.sin(island.rotation||0);value.boatBerths=(layout.berths||[]).map(({boat})=>({x:island.x+boat.x*c+boat.z*s,z:island.z-boat.x*s+boat.z*c}));}
  this.geometry.set(island.id,{layout,value});return value;
 }
 update({position,yaw=0,game,visited=new Set()}){
  const island=selectMapIsland({onLand:game?.player.onLand,island:game?.player.island,nearby:game?.nearby,challengeActive:!!game?.challenges.active});
  const id=island?.id||'world';
  if(this.viewId!==id){
   this.viewId=id;this.island=island;this.canvas.dataset.mapView=id;
   this.title.textContent=island?NAMES[island.id]||island.name:'The archipelago';
   this.mode.textContent=island?'ISLAND':'THE BAY';
   this.button.setAttribute('aria-label',island?`${island.name} island map. Open world map`:'Open archipelago map');
   this.canvas.setAttribute('aria-label',island?`${island.name}: paths, places to explore, dock and your position. North is up.`:'Four islands and your position. North is up.');
   this.legend.hidden=!island;
  }
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  const dpr=Math.min(globalThis.devicePixelRatio||1,3),bw=Math.round(w*dpr),bh=Math.round(h*dpr);
  if(this.canvas.width!==bw||this.canvas.height!==bh){this.canvas.width=bw;this.canvas.height=bh;}
  const ctx=this.ctx;ctx.setTransform(bw/w,0,0,bh/h,0,0);ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#d3e7e4';ctx.fillRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';
  // Subtle water grid gives bearings without competing with the shoreline.
  ctx.strokeStyle='#bdd8d3';ctx.lineWidth=.6;ctx.beginPath();
  for(let x=20;x<w;x+=28){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=20;y<h;y+=28){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  let projection;
  if(island){
   const layout=game?.walkLayouts?.get(island.id),geometry=this.geometryFor(island,layout);
   // Dock approach and boat berths remain in frame; the map does not chase Jack.
   const points=[...geometry.shore,...geometry.dock,...geometry.approach,island.dock];
   for(const p of geometry.dock)points.push({x:p.x-6,z:p.z-6},{x:p.x+6,z:p.z+6});
   projection=createMapProjection(points,w,h,w<190?15:21);
   this.drawIsland(geometry,projection,true,visited.has(island.id));
   this.drawDetails(island,geometry,projection,w);
  }else{
   const r=this.worldRadius;projection=createMapProjection([{x:-r,z:-r},{x:r,z:r}],w,h,12);
   for(const i of this.islands){this.drawIsland(this.geometryFor(i,null),projection,false,visited.has(i.id));}
   for(const c of this.challenges){const p=projection.project(c);this.dot(p,3,'#bc744b',PAPER);}
   for(const i of this.islands){const p=projection.project(i);this.tag(NAMES[i.id]||i.name,p.x,p.y,10,w);}
  }
  this.drawChallenge(game?.challenges,projection);
  if(island&&game?.player.onLand&&game.boat){this.vehicle(projection.project(game.boat.position),game.boat.yaw,'boat');}
  if(island?.id==='education'&&game?.bicycle?.parked){this.vehicle(projection.project(game.bicycle.position),game.bicycle.yaw,'bicycle');}
  if(island?.id==='projects'&&game?.quadBike?.parked){this.vehicle(projection.project(game.quadBike.position),game.quadBike.yaw,'quad');}
  if(island?.id==='about')for(const car of game?.garageCars||[])if(car.parked)this.vehicle(projection.project(car.position),car.yaw,'car');
  if(island?.id==='experience'&&game?.careerTrain&&!game.player.ridingTrain)this.vehicle(projection.project(game.careerTrain.position),trainMapHeading(game.careerTrain),'train');
  this.player(projection.project(position),game?.player.ridingTrain?trainMapHeading(game.careerTrain):yaw,w,h);
  this.compass(w);
 }
 polygon(points,projection){
  const c=this.ctx;c.beginPath();points.forEach((p,n)=>{const q=projection.project(p);n?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();
 }
 drawIsland(geometry,projection,local,visited){
  const c=this.ctx;this.polygon(geometry.shore,projection);c.lineWidth=local?6:3;c.strokeStyle='#f2e5bd';c.stroke();c.fillStyle=local?'#c7d7af':visited?'#b7cc9c':'#c7d8b8';c.fill();c.lineWidth=1;c.strokeStyle='#71968b';c.stroke();
  if(geometry.dock.length){this.polygon(geometry.dock,projection);c.fillStyle='#c8a47a';c.fill();c.strokeStyle='#866c50';c.lineWidth=1;c.stroke();}
 }
 drawDetails(island,g,projection,w){
  const c=this.ctx,career=island.id==='experience'&&g.tracks.some(track=>track.stops?.length);
  for(const campus of g.campuses){if(!campus.polygon.length)continue;this.polygon(campus.polygon,projection);c.fillStyle=campus.schoolId==='bu'?'#dbcac2':'#c0d0a5';c.fill();}
  if(g.terrain.length){
   const key=[island.id,w,this.canvas.clientHeight,projection.scale].join(':');
   if(g.mapPaths?.key!==key){
    const experience=island.id==='experience',bands=(experience?EXPERIENCE_TERRACE_COLORS:TERRAIN_COLORS).map(color=>({color,path:new Path2D()}));
    for(const face of g.terrain){const index=experience?careerTerrainBand(face.height):Math.max(0,Math.min(4,Math.floor(face.height/2))),band=bands[index];face.points.forEach((p,n)=>{const q=projection.project(p);n?band.path.lineTo(q.x,q.y):band.path.moveTo(q.x,q.y);});band.path.closePath();}
    g.mapPaths={key,bands};
   }
   for(const band of g.mapPaths.bands){c.fillStyle=band.color;c.fill(band.path);}
  }
  for(const road of g.roads.length?g.roads:[{points:g.route,width:2.05}])if(road.points.length){c.beginPath();road.points.forEach((p,n)=>{const q=projection.project(p);n?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.lineWidth=Math.max(2.5,projection.scale*road.width);c.strokeStyle=road.kind==='drive'?'#7e8586':'#fff3d5';c.stroke();}
  for(const area of g.parkingAreas){this.polygon(area.polygon,projection);c.fillStyle='#c6c5b8';c.fill();for(const stall of area.stalls){this.polygon(stall.polygon,projection);c.strokeStyle='#faf4df';c.lineWidth=.9;c.stroke();}}
  for(const o of g.obstacles){if(o.width*o.depth<2||o.height<1.4)continue;this.polygon(o.polygon,projection);c.fillStyle=o.mapColor||'#98afa0';c.fill();c.strokeStyle='#718b80';c.lineWidth=.7;c.stroke();}
  for(const landmark of g.landmarks){if(g.parkingAreas.some(area=>area.id===landmark.id))continue;this.polygon(landmark.polygon,projection);c.fillStyle=landmark.id==='duan-center'?'#718c9f':'#b5ac91';c.fill();c.strokeStyle='#566b71';c.lineWidth=.8;c.stroke();}
  for(const track of g.tracks){c.beginPath();track.points.forEach((p,n)=>{const q=projection.project(p);n?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.strokeStyle='#505969';c.lineWidth=2.4;c.stroke();c.strokeStyle='#d6c4a5';c.lineWidth=.8;c.setLineDash([1,2]);c.stroke();c.setLineDash([]);}
  for(const track of g.tracks)for(const stop of track.stops||[]){const p=projection.project(stop);this.dot(p,5.2,'#5b4b3e',PAPER);c.fillStyle=PAPER;c.font='700 8px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(stop.label,p.x,p.y+.4);}
  // Company reader/action dots repeat the railway platforms on this island
  // and obscure their numbers at phone sizes. The four rail stops are its key.
  if(!career)for(const s of g.stations){const p=projection.project(s);this.dot(p,s.type==='read'?3.4:2.3,s.type==='read'?'#285d72':'#94804d',PAPER);}
  if(career){
   const key=[w,this.canvas.clientHeight,projection.scale,projection.bounds?.minX,projection.bounds?.minZ].join(':');
   if(g.careerLabels?.key!==key)g.careerLabels={key,labels:careerMapLabels(g,projection,w,this.canvas.clientHeight,(text,size)=>{c.font=`600 ${size}px 'DM Sans', sans-serif`;return c.measureText(text).width;})};
   for(const item of g.careerLabels.labels)this.tag(item.text,item.cx,item.cy,item.size,w);
  }else if(island.id==='education'){
   const schools=g.campuses.length?g.campuses:g.stations.filter(s=>s.schoolId&&s.primary);
   const duan=g.landmarks.find(l=>l.id==='duan-center');if(duan){const p=projection.project(duan);this.tag(w<190?'Duan':'Duan Center',p.x,p.y-7,w<190?8:9,w);}
   for(const school of schools){const p=projection.project(school);this.tag(school.schoolId==='bu'?'BU':'CMU',p.x,p.y-13,10,w);}
  }else if(island.id==='about'){
   for(const l of g.landmarks){const p=projection.project(l);const dy=({'jack-house':9,garage:-10,tennis:0,golf:12,lighthouse:-11,'coast-overlook':-12})[l.id]??-5;this.tag(({ 'jack-house':'House',garage:'Garage',tennis:'Tennis',golf:'Golf',lighthouse:'Light','coast-overlook':'Parking'})[l.id]||l.label,p.x,p.y+dy,w<190?8:9,w);}
  }else{
   for(const d of g.districts){const p=projection.project(d),primary=g.stations.find(s=>s.contentId===d.id&&s.primary);this.tag(`${primary?.number?primary.number+' ':''}${NAMES[d.id]||d.id}`,p.x,p.y-16,w<190?9:10,w);}
  }
  const dock=g.dock;if(!career&&dock.length){const p=projection.project({x:dock.reduce((sum,p)=>sum+p.x,0)/dock.length,z:dock.reduce((sum,p)=>sum+p.z,0)/dock.length});this.tag('Dock',p.x,p.y+13,9,w);}
 }
 dot(p,r,fill,stroke){const c=this.ctx;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();}}
 tag(text,x,y,size,w){
  const c=this.ctx;c.font=`600 ${size}px 'DM Sans', sans-serif`;const width=c.measureText(text).width+8,height=size+7;
  x=Math.max(width/2+3,Math.min(w-width/2-3,x));y=Math.max(height/2+3,Math.min(this.canvas.clientHeight-height/2-3,y));
  c.fillStyle='#fffbeeeb';c.beginPath();c.roundRect(x-width/2,y-height/2,width,height,4);c.fill();c.fillStyle=INK;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y+.5);
 }
 vehicle(p,yaw,kind){
  const c=this.ctx;c.save();c.translate(p.x,p.y);c.rotate(-yaw);c.fillStyle=INK;c.strokeStyle=PAPER;c.lineWidth=1.5;c.beginPath();
  if(kind==='boat'){c.moveTo(0,-7);c.lineTo(4.5,-1);c.lineTo(4.5,6);c.lineTo(-4.5,6);c.lineTo(-4.5,-1);c.closePath();c.fill();c.stroke();}
  else if(kind==='train'){c.roundRect(-3,-9,6,18,2);c.fill();c.stroke();c.fillStyle='#dfb477';c.fillRect(-2,-5,4,3);c.fillRect(-2,3,4,3);}
  else if(kind==='bicycle'){c.lineWidth=2;c.beginPath();c.moveTo(0,-6);c.lineTo(0,6);c.moveTo(-4,-4);c.lineTo(4,-4);c.strokeStyle=INK;c.stroke();for(const y of[-6,6]){c.beginPath();c.ellipse(0,y,2,3,0,0,Math.PI*2);c.fill();c.strokeStyle=PAPER;c.lineWidth=1;c.stroke();}}
  else{c.fillRect(-3,-5,6,10);for(const x of[-6,3])for(const y of[-5,2])c.fillRect(x,y,3,4);c.strokeRect(-3,-5,6,10);}
  c.restore();
 }
 player(p,yaw,w,h){
  const c=this.ctx;c.save();c.translate(Math.max(9,Math.min(w-9,p.x)),Math.max(9,Math.min(h-9,p.y)));c.rotate(-yaw);
  c.beginPath();c.arc(0,0,11,0,Math.PI*2);c.fillStyle='#fffaf090';c.fill();c.beginPath();c.moveTo(0,-8);c.lineTo(6.5,6.5);c.lineTo(0,3);c.lineTo(-6.5,6.5);c.closePath();c.fillStyle=ORANGE;c.fill();c.strokeStyle=PAPER;c.lineWidth=2;c.stroke();c.restore();
 }
 compass(w){const c=this.ctx;c.fillStyle=INK;c.font="700 9px 'DM Sans', sans-serif";c.textAlign='center';c.textBaseline='middle';c.fillText('N',w-13,12);c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(w-13,30);c.lineTo(w-13,20);c.moveTo(w-16,23);c.lineTo(w-13,20);c.lineTo(w-10,23);c.stroke();}
 drawChallenge(challenge,projection){
  if(!challenge?.active)return;const c=this.ctx;
  if(challenge.kind==='buoy'){
   c.beginPath();this.gates.forEach((g,n)=>{const p=projection.project(g);n?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.strokeStyle='#b47b50';c.lineWidth=1.3;c.setLineDash([3,4]);c.stroke();c.setLineDash([]);
   this.gates.forEach((g,n)=>this.dot(projection.project(g),n===challenge.index?5:3,n<challenge.index?'#76966b':n===challenge.index?ORANGE:'#a58265',PAPER));
  }else if(challenge.kind==='lighthouse'){
   this.lamps.forEach((l,n)=>{const p=projection.project(l);this.dot(p,5,l.color,PAPER);c.fillStyle=INK;c.font='700 9px sans-serif';c.textAlign='center';c.fillText(l.symbol,p.x,p.y-9);});
  }else if(challenge.kind==='cargo'){
   for(const b of challenge.berths){const p=projection.project(b);c.fillStyle=b.color;c.fillRect(p.x-4,p.y-3,8,6);c.strokeStyle=INK;c.strokeRect(p.x-4,p.y-3,8,6);}
  }
 }
}
