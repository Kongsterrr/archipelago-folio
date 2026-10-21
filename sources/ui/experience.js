import {experienceEntries,experienceMetadata} from '../core/experience-content.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const tags=items=>`<div class="tags">${items.map(item=>`<span class="tag">${esc(item)}</span>`).join('')}</div>`;

function contactLinks({game=false,overview=false}={}) {
  return `<div class="panel-links experience-links">
    <a class="primary-button" href="/resume.pdf" target="_blank" rel="noopener noreferrer">Download résumé<span class="sr-only"> (opens in a new tab)</span></a>
    <button type="button" class="secondary-button" data-open="connect">Contact Jack</button>
    ${game?`<button type="button" class="text-link" data-travel="experience">${overview?'Travel here':'Travel to Experience'}</button>`:''}
  </div>`;
}

export function experienceCard(entry) {
  const meta=experienceMetadata(entry);
  return `<article class="experience-card experience-${esc(entry.id)}" data-experience-card="${esc(entry.id)}">
    <button type="button" class="experience-card-link" data-open="${esc(entry.id)}" aria-label="Read experience at ${esc(entry.title)}">
      <span class="experience-card-top"><span class="experience-company">${esc(entry.title)}</span><span class="experience-card-arrow">${arrow}</span></span>
      <span class="experience-card-role">${esc(meta.role)}${meta.location?`<span class="experience-card-location">${esc(meta.location)}</span>`:''}</span>
      <span class="experience-card-period">${esc(entry.period)}</span>
      <span class="experience-card-theme">${esc(meta.theme)}</span>
      <span class="experience-card-impact">${esc(meta.highlight)}</span>
      <span class="experience-card-read">Read experience</span>
    </button>
  </article>`;
}

export function experienceOverview(content,{game=false}={}) {
  const entries=experienceEntries(content);
  return `<div class="experience-overview">
    <span class="eyebrow">ISLAND 02 / EXPERIENCE</span>
    <h2 class="panel-hero" id="panel-title">Where I’ve worked.</h2>
    <p class="panel-summary">Full-stack engineering, from personalized experiences to enterprise systems.</p>
    <p class="experience-list-label">CAREER TIMELINE <span>Most recent first</span></p>
    <ol class="experience-timeline" aria-label="Work experience, most recent first">${entries.map(entry=>`<li>${experienceCard(entry)}</li>`).join('')}</ol>
    ${contactLinks({game,overview:true})}
    ${game?'<p class="experience-tour-note">On the island, the summit train follows the journey from VisionX to BeaconFire to Amtrak.</p>':''}
  </div>`;
}

export function experienceDetail(entry,{game=false}={}) {
  const meta=experienceMetadata(entry);
  return `<article class="experience-detail experience-${esc(entry.id)}" data-experience-detail="${esc(entry.id)}">
    <span class="eyebrow">EXPERIENCE / ${esc(meta.theme)}</span>
    <h2 class="panel-hero" id="panel-title">${esc(entry.title)}</h2>
    <p class="experience-role">${esc(meta.role)}</p>
    <p class="experience-meta">${meta.location?`<span>${esc(meta.location)}</span>`:''}<span>${esc(entry.period)}</span></p>
    <section class="experience-built"><h3>What I built</h3><p>${esc(meta.workSummary)}</p></section>
    ${entry.results?.length?`<section class="experience-impact"><h3>Impact</h3><ul>${entry.results.map(result=>`<li>${esc(result)}</li>`).join('')}</ul></section>`:''}
    ${entry.contributions?.length?`<section class="panel-section experience-contributions"><h3>My contribution</h3><ul>${entry.contributions.map(contribution=>`<li>${esc(contribution)}</li>`).join('')}</ul></section>`:''}
    ${entry.technologies?.length?`<section class="panel-section experience-technologies"><h3>Core technologies</h3>${tags(meta.featuredTechnologies)}<details class="experience-full-stack"><summary tabindex="0">Full technology stack <span>${entry.technologies.length}</span></summary>${tags(entry.technologies)}</details></section>`:''}
    ${contactLinks({game})}
    <p class="panel-footnote">Concept illustration · The island’s interactive examples illustrate work themes. The experience above describes my résumé.</p>
  </article>`;
}
