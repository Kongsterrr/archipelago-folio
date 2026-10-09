// Both map modes use world X/Z, with north (-Z) at the top of the canvas.
export function selectMapIsland({onLand,island,nearby,challengeActive=false}){
 return onLand?(island??null):challengeActive?null:(nearby??null);
}

export function createMapProjection(points,width,height,padding=18){
 const valid=points.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z));
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of valid){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
 if(!valid.length){minX=maxX=minZ=maxZ=0;}
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 const spanX=Math.max(20,maxX-minX),spanZ=Math.max(20,maxZ-minZ);
 const inset=Math.max(0,Math.min(padding,(Math.min(width,height)-1)/2));
 const scale=Math.min((width-2*inset)/spanX,(height-2*inset)/spanZ);
 return {
  project:({x,z})=>({x:width/2+(x-centerX)*scale,y:height/2+(z-centerZ)*scale}),
  scale,
  bounds:{minX:centerX-spanX/2,maxX:centerX+spanX/2,minZ:centerZ-spanZ/2,maxZ:centerZ+spanZ/2},
 };
}

function worldPoint(island,p){
 const c=Math.cos(island.rotation??0),s=Math.sin(island.rotation??0);
 const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[1]:p.z;
 return{x:island.x+x*c+z*s,z:island.z-x*s+z*c};
}

function rectangle({x=0,z=0,width,depth,rotation=0}){
 const c=Math.cos(rotation),s=Math.sin(rotation);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{
  const dx=a*width/2,dz=b*depth/2;
  return{x:x+dx*c+dz*s,z:z-dx*s+dz*c};
 });
}

export function islandMapGeometry(island,layout={}){
 const empty={shore:[],dock:[],approach:[],route:[],stations:[],districts:[],campuses:[],landmarks:[],obstacles:[],roads:[],parkingAreas:[],terrain:[]};
 if(!island)return empty;
 layout=layout??{};
 const project=p=>worldPoint(island,p),dock=layout.dock??island.pier,approach=island.approach;
 return {
  shore:(layout.shore??island.shore??[]).map(project),
  dock:dock?rectangle({width:dock.width,depth:dock.endZ-dock.startZ,z:(dock.startZ+dock.endZ)/2}).map(project):[],
  // Match DockInteraction's .75m retention buffer so arrival never clips the boat.
  approach:approach?rectangle({x:(approach.min[0]+approach.max[0])/2,z:(approach.min[2]+approach.max[2])/2,width:approach.max[0]-approach.min[0]+1.5,depth:approach.max[2]-approach.min[2]+1.5}).map(project):[],
  route:(layout.route??[]).map(project),
  roads:layout.roads?.length?layout.roads.map(road=>({...road,points:road.points.map(([x,y,z])=>project({x,z}))})):(layout.paths??[]).map(path=>({...path,points:path.points.map(project)})),
  terrain:layout.terrain?Array.from({length:layout.terrain.indices.length/3},(_,index)=>{
   const v=layout.terrain.vertices,ids=layout.terrain.indices.slice(index*3,index*3+3);
   return{height:ids.reduce((sum,id)=>sum+v[id*3+1],0)/3,points:ids.map(id=>project({x:v[id*3],z:v[id*3+2]}))};
  }):[],
  stations:(layout.stations??[]).map(station=>({...station,...project(station)})),
  districts:(layout.districts??island.districts??[]).map(district=>({...district,...project(district)})),
  campuses:(layout.campuses??[]).map(campus=>({...campus,...project(campus),polygon:(campus.polygon??[]).map(project)})),
  parkingAreas:(layout.parkingAreas??[]).map(area=>({...area,...project(area),polygon:rectangle(area).map(project),stalls:(area.stalls??[]).map(stall=>({...stall,polygon:rectangle(stall).map(project)}))})),
  landmarks:(layout.landmarks??[]).map(landmark=>({...landmark,...project(landmark),polygon:rectangle(landmark).map(project)})),
  obstacles:(layout.obstacles??[]).map(obstacle=>({...obstacle,...project(obstacle),polygon:rectangle(obstacle).map(project)})),
 };
}
