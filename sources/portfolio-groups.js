// Content IDs stay stable; these four destinations own the physical world.
export const portfolioGroups = [
  {id:'about', n:1, name:'Jack Kong', label:'About', entryIds:['harbor','connect'], summary:'Meet Jack, explore his engineering background, download his résumé, and get in touch.', accent:'#f4bd69'},
  {id:'experience', n:2, name:'Experience', label:'Experience', entryIds:['amtrak','beaconfire','visionx'], summary:'Full-stack engineering, enterprise systems, and AI experiences at Amtrak, BeaconFire, and VisionX.', accent:'#78afcd'},
  {id:'projects', n:3, name:'Projects', label:'Projects', entryIds:['affirmation','research','catering'], summary:'Explore ADHD Affirmation, Movie Piracy Research, and the Business Catering Dashboard.', accent:'#ba9aca'},
  {id:'education', n:4, name:'Education', label:'Education', entryIds:['learning'], summary:'Information systems at Carnegie Mellon University, and computer science and mathematics at Boston University.', accent:'#a9c68a'}
];
export const PHYSICAL_ISLAND_IDS = portfolioGroups.map(group=>group.id);
export const CONTENT_IDS = portfolioGroups.flatMap(group=>group.entryIds);
export function groupFor(id){return portfolioGroups.find(group=>group.id===id||group.entryIds.includes(id));}
export function islandIdFor(id){return groupFor(id)?.id;}
export const VOYAGE_STAMP_TOTAL = PHYSICAL_ISLAND_IDS.length + 6 + 3;
