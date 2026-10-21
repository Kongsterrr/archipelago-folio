// Reading is newest first; the sightseeing train keeps its chronological route.
export const EXPERIENCE_ORDER=Object.freeze(['amtrak','beaconfire','visionx']);
export const EXPERIENCE_VIEWS=Object.freeze(['experience',...EXPERIENCE_ORDER]);

export function experienceEntries(content=[]) {
  return EXPERIENCE_ORDER.map(id=>content.find(entry=>entry.id===id&&entry.category==='experience')).filter(Boolean);
}

export function initialExperienceView(search='') {
  const view=new URLSearchParams(search).get('view');
  return EXPERIENCE_VIEWS.includes(view)?view:null;
}

export function experienceMetadata(entry) {
  const [role='',...locationParts]=String(entry.eyebrow||'').split(' · ');
  return {
    role,
    location:locationParts.join(' · '),
    theme:entry.theme||entry.title,
    trainTheme:entry.trainTheme||entry.theme||entry.title,
    workSummary:entry.workSummary||entry.summary||'',
    highlight:entry.results?.[0]||entry.summary||'',
    featuredTechnologies:(entry.featuredTechnologies||entry.technologies||[]).slice(0,4),
  };
}
