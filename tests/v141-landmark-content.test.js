import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {campusLandmarks,getCampusLandmark,duanThemes} from '../sources/campus-landmarks.js';

const landmark=getCampusLandmark('duan-center');

test('Duan Center is an independently addressable Education landmark with concise sourced content',()=>{
 assert.equal(campusLandmarks.length,1);
 assert.equal(landmark,campusLandmarks[0]);
 assert.equal(landmark.schoolId,'bu');assert.equal(landmark.islandId,'education');
 assert.equal(landmark.title,'Duan Family Center for Computing & Data Sciences');
 assert.equal(landmark.shortName,'Duan Center');
 assert.ok(landmark.summary.length>0);assert.equal(landmark.sections.length,3);
 for(const section of landmark.sections){assert.ok(section.title.length>0);assert.ok(section.body.length>0);}
 const words=[landmark.summary,...landmark.sections.map(s=>s.body)].join(' ').split(/\s+/);
 assert.ok(words.length<200,'short original prose stays below each source allowance');
 const urls=landmark.sources.map(source=>new URL(source.url));
 assert.deepEqual(urls.map(url=>url.hostname),['www.bu.edu','www.kpmb.com']);
 assert.ok(urls.every(url=>url.protocol==='https:'));
 assert.ok(landmark.sources.every(source=>source.label));
 assert.equal(getCampusLandmark('learning'),null,'a school overview is not a landmark');
 assert.equal(getCampusLandmark('missing'),null);assert.equal(getCampusLandmark(null),null);
});

test('the campus timeline does not imply that Jack studied at a building opened after his degree',async()=>{
 const content=JSON.parse(await fs.readFile(new URL('../sources/content.json',import.meta.url),'utf8'));
 const school=content.find(item=>item.id==='learning').schools.find(item=>item.schoolId==='bu');
 assert.equal(school.period,'May 2022');assert.ok(landmark.note.includes(school.period));
 assert.match(landmark.note,/campus landmark/);assert.match(landmark.note,/not a claim that Jack studied/);
 assert.match(landmark.note,/before the center opened/);
 const history=landmark.sections.map(section=>section.body).join(' ');
 assert.match(history,/opened on December 8, 2022/);assert.match(history,/current name in December 2024/);
 assert.ok(Date.parse(school.period)<Date.parse('December 8, 2022'));
});

test('landmark data cannot be mutated by scene animation or reused reading panels',()=>{
 const walk=value=>{if(value && typeof value==='object'){assert.ok(Object.isFrozen(value));for(const child of Object.values(value))walk(child);}};
 walk(campusLandmarks);walk(duanThemes);
 assert.throws(()=>{landmark.sections[0].body='changed';},TypeError);
 assert.throws(()=>{landmark.sources.push({label:'extra',url:'https://example.com'});},TypeError);
 assert.throws(()=>{duanThemes[0].id='changed';},TypeError);
 assert.equal(getCampusLandmark('duan-center'),landmark);
});

test('the three concept themes expose stable action IDs without fabricated live metrics',()=>{
 assert.deepEqual(duanThemes.map(theme=>theme.id),['sunlight','ground-heat','collaboration']);
 assert.equal(new Set(duanThemes.map(theme=>theme.id)).size,duanThemes.length);
 for(const theme of duanThemes){assert.ok(theme.title);assert.ok(theme.description);assert.doesNotMatch(theme.description,/\d|\b(live|real-time|current output)\b/i);}
 const themeWords=duanThemes.map(theme=>theme.description).join(' ').split(/\s+/).length;
 const contentWords=[landmark.summary,...landmark.sections.map(s=>s.body)].join(' ').split(/\s+/).length;
 assert.ok(themeWords+contentWords<200,'combined architectural prose and concept themes remain concise');
});

const {exhibitTarget,schoolTarget,landmarkTarget}=await import('../sources/core/portfolio-navigation.js');
const {landmarkCards,landmarkDetail}=await import('../sources/ui/campus-landmarks.js');
const {portfolioGroups}=await import('../sources/portfolio-groups.js');
const portfolioContent=JSON.parse(await fs.readFile(new URL('../sources/content.json',import.meta.url),'utf8'));
const testIslands=portfolioGroups.map(group=>({...group}));

test('landmark exhibits stay distinct from academic school views, including school-tagged landmark stations',()=>{
 const target=exhibitTarget({contentId:'learning',schoolId:'bu',landmarkId:'duan-center',readFull:true},'education',portfolioContent,testIslands);
 assert.equal(target.landmark,landmark);assert.equal(target.school,undefined);assert.equal(target.island.id,'education');assert.equal(target.entry.id,'learning');
 assert.deepEqual(target,landmarkTarget('duan-center',portfolioContent,testIslands));
 const school=exhibitTarget({contentId:'learning',schoolId:'bu',readFull:true},'education',portfolioContent,testIslands);
 assert.equal(school.school.schoolId,'bu');assert.equal(school.landmark,undefined);assert.deepEqual(school,schoolTarget('bu',portfolioContent,testIslands));
 assert.equal(exhibitTarget({landmarkId:'missing',schoolId:'bu',contentId:'learning'},'education',portfolioContent,testIslands),null,'an invalid landmark does not silently open an unrelated degree panel');
 assert.equal(landmarkTarget('duan-center',[],testIslands).entry,null,'missing academic content is not fabricated');
});

test('campus cards and full HTML detail provide a separate landmark reading path with explicit history and sources',()=>{
 const cards=landmarkCards(campusLandmarks),detail=landmarkDetail(landmark);
 assert.match(cards,/data-landmark="duan-center"/);assert.doesNotMatch(cards,/data-school=/);assert.match(cards,/About this landmark/);assert.match(cards,/CAMPUS LANDMARK \/ BU/);
 assert.equal(landmarkCards([]),'');assert.match(detail,/data-landmark-detail="duan-center"/);
 for(const section of landmark.sections){assert.ok(detail.includes(section.title));assert.ok(detail.includes(section.body));}
 assert.ok(detail.includes('before the center opened'));assert.ok(detail.includes('May 2022'));assert.ok(detail.includes('December 8, 2022'));assert.ok(detail.includes('December 2024'));
 for(const source of landmark.sources){assert.ok(detail.includes(source.url));assert.ok(detail.includes(source.label));}
 assert.equal((detail.match(/rel="noopener noreferrer"/g)||[]).length,2);assert.equal((detail.match(/opens in a new tab/g)||[]).length,2);
});

test('landmark renderers escape text and reject non-HTTPS source actions',()=>{
 const sample={...landmark,id:'duan" onclick="bad()',shortName:'<img src=x>',title:'A & B',summary:'<script>bad()</script>',sections:[{title:'<svg>',body:'<b>not markup</b>'}],sources:[{label:'Unsafe',url:'javascript:bad()'},{label:'<strong>Source</strong>',url:'https://www.bu.edu/?q=" onclick="bad()'}]};
 const cards=landmarkCards([sample]),detail=landmarkDetail(sample);
 for(const html of[cards,detail]){assert.doesNotMatch(html,/<img|<script>|<svg>|<strong>|<b>/);assert.ok(html.includes('&lt;script&gt;'));}
 assert.ok(cards.includes('&lt;img'));assert.ok(detail.includes('A &amp; B'));assert.doesNotMatch(detail,/javascript:/);assert.ok(detail.includes('&lt;strong&gt;Source&lt;/strong&gt;'));assert.ok(detail.includes('&quot; onclick=&quot;'));
});
