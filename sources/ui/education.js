const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function educationCards(schools,{complete=false}={}) {
  return schools.map(school=>`<article class="school-card school-${esc(school.schoolId)}" data-school-card="${esc(school.schoolId)}"><button class="school-card-link" data-school="${esc(school.schoolId)}" aria-label="View education at ${esc(school.title)}"><span class="school-monogram" aria-hidden="true">${esc(school.shortName)}</span><span class="school-card-copy"><h3>${esc(school.title)}</h3><span class="school-degree">${esc(school.degree)}${school.degreeNote?` · ${esc(school.degreeNote)}`:''}</span><span class="school-meta">${esc(school.period)} · GPA ${esc(school.gpa)}</span><span class="school-read">View education</span></span></button>${complete?educationTopics(school):''}</article>`).join('');
}

export function educationTopics(school) {
  return `<section class="school-topics"><h3>Areas of study</h3><ul>${school.topics.map(topic=>`<li>${esc(topic)}</li>`).join('')}</ul></section>`;
}

export function educationDetail(school) {
  return `<div class="school-detail school-${esc(school.schoolId)}" data-school-detail="${esc(school.schoolId)}"><span class="eyebrow">EDUCATION / ${esc(school.shortName)}</span><h2 class="panel-hero" id="panel-title">${esc(school.title)}</h2><p class="panel-summary">${esc(school.degree)}${school.degreeNote?`<br><span class="school-degree-note">${esc(school.degreeNote)}</span>`:''}</p><dl class="school-facts"><div><dt>Completed</dt><dd>${esc(school.period)}</dd></div><div><dt>GPA</dt><dd>${esc(school.gpa)}</dd></div></dl>${educationTopics(school)}</div>`;
}
