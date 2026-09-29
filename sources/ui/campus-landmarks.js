const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function landmarkCards(landmarks){
 return landmarks.length?`<section class="panel-section campus-landmark-list"><h3>Explore the campus</h3>${landmarks.map(l=>`<button class="directory-card landmark-card" data-landmark="${esc(l.id)}"><small>CAMPUS LANDMARK / ${esc(l.schoolId.toUpperCase())}</small><h3>${esc(l.shortName)}</h3><p>${esc(l.summary)}</p><span class="school-read">About this landmark</span></button>`).join('')}</section>`:'';
}
export function landmarkDetail(landmark){
 return `<article class="landmark-detail" data-landmark-detail="${esc(landmark.id)}"><span class="eyebrow">CAMPUS LANDMARK / ${esc(landmark.schoolId.toUpperCase())}</span><h2 class="panel-hero" id="panel-title">${esc(landmark.title)}</h2><p class="panel-summary">${esc(landmark.summary)}</p>${landmark.sections.map(s=>`<section class="panel-section"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></section>`).join('')}<p class="panel-footnote">${esc(landmark.note)}</p><section class="panel-section"><h3>Explore the real building</h3><div class="panel-links">${landmark.sources.filter(s=>s.url.startsWith('https://')).map(s=>`<a class="text-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}<span class="sr-only"> (opens in a new tab)</span></a>`).join('')}</div></section></article>`;
}
