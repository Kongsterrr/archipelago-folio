import test from 'node:test';
import assert from 'node:assert/strict';
import content from '../sources/content.json' with {type:'json'};
import {experienceEntries,experienceMetadata,initialExperienceView} from '../sources/core/experience-content.js';
import {experienceOverview,experienceDetail,experienceCard} from '../sources/ui/experience.js';

const entries=experienceEntries(content);
const escape=value=>value.replaceAll('&','&amp;').replaceAll("'",'&#39;');

test('V23 career overview is newest first and uses existing role, place, date and results',()=>{
  assert.deepEqual(entries.map(entry=>entry.id),['amtrak','beaconfire','visionx']);
  const markup=experienceOverview(content);
  const order=[...markup.matchAll(/data-experience-card="([a-z]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order,['amtrak','beaconfire','visionx']);
  for(const entry of entries){
    const card=experienceCard(entry),{role,location}=experienceMetadata(entry);
    for(const value of [entry.title,entry.period,role,location,entry.theme,entry.results[0]])assert.ok(card.includes(escape(value)),`${entry.id}: ${value}`);
  }
  assert.doesNotMatch(markup,/data-travel=/);
  assert.match(experienceOverview(content,{game:true}),/data-travel="experience">Travel here/);
  assert.match(markup,/href="\/resume\.pdf"/);
  assert.match(markup,/data-open="connect"/);
});

test('V23 details retain every contribution, result and technology without mixing companies',()=>{
  for(const entry of entries){
    const markup=experienceDetail(entry),{role,location}=experienceMetadata(entry);
    for(const value of [role,location,entry.period,...entry.contributions,...entry.results,...entry.technologies])assert.ok(markup.includes(escape(value)),`${entry.id}: ${value}`);
    assert.ok(markup.indexOf('What I built')<markup.indexOf('Impact'));
    assert.ok(markup.indexOf('Impact')<markup.indexOf('My contribution'));
    assert.ok(markup.indexOf('My contribution')<markup.indexOf('Core technologies'));
    assert.match(markup,/<details class="experience-full-stack">/);
    const core=markup.slice(markup.indexOf('Core technologies'),markup.indexOf('<details'));
    assert.equal((core.match(/class="tag"/g)||[]).length,4);
    assert.match(markup,/Concept illustration/);
    for(const other of entries.filter(other=>other!==entry))assert.ok(!markup.includes(other.eyebrow));
  }
});

test('V23 featured technology choices are grounded in the full source stack',()=>{
  assert.deepEqual(entries[0].featuredTechnologies,['Angular Signals','TypeScript','Spring Boot','PostgreSQL']);
  assert.deepEqual(entries[1].featuredTechnologies,['React','Flask','RabbitMQ','LangChain']);
  assert.deepEqual(entries[2].featuredTechnologies,['Python','Django','ChatGPT','AWS']);
  for(const entry of entries)for(const featured of entry.featuredTechnologies){
    assert.ok(entry.technologies.includes(featured)||(featured==='AWS'&&entry.technologies.some(technology=>technology.startsWith('AWS '))));
  }
  assert.match(experienceDetail(entries[0]),/Supported 8,000\+ union employees/);
  assert.equal((experienceDetail(entries[0]).match(/8,000\+/g)||[]).length,1,'system population is stated once rather than duplicated in the summary');
  assert.match(experienceDetail(entries[2]),/engagement by 15%/);
  assert.match(experienceDetail(entries[2]),/satisfaction by 19%/);
});

test('V23 initial reading links accept only the four intended view values',()=>{
  for(const view of ['experience','amtrak','beaconfire','visionx']){
    assert.equal(initialExperienceView(`?view=${view}`),view);
    assert.equal(initialExperienceView(`?no3d&view=${view}`),view);
    assert.equal(initialExperienceView(new URLSearchParams({view})),view);
  }
  for(const search of ['','?view=','?view=projects','?view=AMTRAK','?view=constructor','?view=%3Cscript%3E','?other=amtrak'])assert.equal(initialExperienceView(search),null);
});

test('V23 rendering escapes content and keeps each experience card one semantic button',()=>{
  const entry={...entries[0],title:'<img src=x onerror=alert(1)>',eyebrow:'A & B · <script>location</script>',theme:'<script>theme</script>',workSummary:'<script>summary</script>',contributions:['<script>contribution</script>'],results:['<script>result</script>'],technologies:['<script>technology</script>'],featuredTechnologies:['<script>core</script>']};
  for(const markup of [experienceCard(entry),experienceDetail(entry)]){
    assert.doesNotMatch(markup,/<img|<script/);
    assert.match(markup,/&lt;img/);
    assert.match(markup,/A &amp; B/);
  }
  const card=experienceCard(entries[0]);
  assert.equal((card.match(/<button /g)||[]).length,1);
  assert.doesNotMatch(card,/<a |<h[1-6]/);
});
