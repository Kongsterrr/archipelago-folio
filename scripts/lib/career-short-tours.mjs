// Short, level visits begin and end at the existing funicular boarding points.
// The same paths drive the map and actual-character checks.
export function careerShortTours(railway){
 const visits={
  visionx:{y:8.05,readerId:'visionx:plants',actionIds:['visionx:water'],points:[[4.7,16.7],[7,16.7],[4.7,16.7],[4.7,15.1],[8,12]]},
  beaconfire:{y:14.55,readerId:'beaconfire:fullstack',actionIds:['beaconfire:pipeline'],points:[[-2.4,3.6],[-4.8,3.6],[-2.4,3.6],[-2.4,1.1],[-7.6,0]]},
  amtrak:{y:21.55,readerId:'amtrak:experience',actionIds:[],points:[[-5.8,-10.4]]},
 };
 return railway.stations.filter(s=>visits[s.id]).map(station=>{
  const visit=visits[station.id],start=[station.boarding.x,station.boarding.z];
  return{id:station.id+'-short-visit',contentId:station.id,...visit,points:[start,...visit.points,start],width:1.2};
 });
}
