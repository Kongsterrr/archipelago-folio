import {getCampusLandmark} from '../campus-landmarks.js';
import {portfolioGroups,groupFor,islandIdFor} from '../portfolio-groups.js';

// One mapping serves the directory, plain HTML fallback, map and automation.
export function directoryGroups(content,category='all') {
  const id=category==='project'?'projects':category;
  return portfolioGroups.filter(group=>id==='all'||group.id===id).map(group=>({
    ...group,entries:group.entryIds.map(entryId=>content.find(entry=>entry.id===entryId)).filter(Boolean)
  }));
}

export function portfolioTarget(id,content,islands) {
  const group=groupFor(id);
  if(!group)return null;
  return {group,island:islands.find(island=>island.id===islandIdFor(id)),
    entry:content.find(entry=>entry.id===id)||null,
    entries:group.entryIds.map(entryId=>content.find(entry=>entry.id===entryId)).filter(Boolean)};
}

export function exhibitEntry(station,islandId,content) {
  // Legacy events used the content ID as island; grouped events name it explicitly.
  return content.find(entry=>entry.id===(station?.contentId||islandId))||null;
}

export function exhibitTarget(station,islandId,content,islands) {
  if(station?.landmarkId)return landmarkTarget(station.landmarkId,content,islands);
  if(station?.schoolId)return schoolTarget(station.schoolId,content,islands,station.contentId||'learning');
  // Complete exhibits can open an island overview as well as a source story.
  // Section-only exhibits must still resolve a real story before reading it.
  if(station?.readFull)return portfolioTarget(station.contentId||islandId,content,islands);
  const entry=exhibitEntry(station,islandId,content);
  return entry?portfolioTarget(entry.id,content,islands):null;
}

// Schools are views of the existing education story, not extra islands or save IDs.
export function educationSchools(content) {
  return content.find(entry=>entry.id==='learning')?.schools||[];
}

export function schoolTarget(schoolId,content,islands,contentId='learning') {
  if(contentId!=='learning')return null;
  const school=educationSchools(content).find(school=>school.schoolId===schoolId);
  const target=school&&portfolioTarget('learning',content,islands);
  return target?{...target,school}:null;
}

export function landmarkTarget(landmarkId,content,islands){
  const landmark=getCampusLandmark(landmarkId);
  const target=landmark&&portfolioTarget('learning',content,islands);
  return target?{...target,landmark}:null;
}
