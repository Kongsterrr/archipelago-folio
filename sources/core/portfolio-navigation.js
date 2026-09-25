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
