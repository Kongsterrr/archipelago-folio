// Fit the complete landmark into the part of the canvas left visible by the
// campus reader. All fit bounds are WORLD coordinates by the time they reach
// CameraRig; authored layout bounds remain in island-local coordinates.
export function campusStationFocus(island,station){
 if(!island||!station)return null;
 const local=station.cameraTarget||station,c=Math.cos(island.rotation),s=Math.sin(island.rotation);
 const world=p=>({x:island.x+p.x*c+p.z*s,y:p.y??.85,z:island.z-p.x*s+p.z*c});
 const point=world(local),camera={distance:station.camera?.distance||24,height:point.y+1.8,azimuth:island.rotation,elevation:.66,...station.camera,campus:true};
 if(camera.fitBounds){
  const b=camera.fitBounds,points=[],at=(p,k,n)=>Array.isArray(p)?p[n]:p[k];
  for(const x of[at(b.min,'x',0),at(b.max,'x',0)])for(const y of[at(b.min,'y',1),at(b.max,'y',1)])for(const z of[at(b.min,'z',2),at(b.max,'z',2)])points.push(world({x,y,z}));
  camera.fitBounds={min:['x','y','z'].map(k=>Math.min(...points.map(p=>p[k]))),max:['x','y','z'].map(k=>Math.max(...points.map(p=>p[k])))};
 }
 return{...point,id:island.id,islandId:island.id,contentId:'learning',landmarkId:station.landmarkId,exhibit:true,camera};
}
