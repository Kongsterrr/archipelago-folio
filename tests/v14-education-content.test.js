import test from 'node:test';
import assert from 'node:assert/strict';
import content from '../sources/content.json' with {type:'json'};
import {educationSchools,schoolTarget,exhibitTarget,directoryGroups,portfolioTarget} from '../sources/core/portfolio-navigation.js';
import {educationCards,educationDetail} from '../sources/ui/education.js';
import {portfolioGroups,CONTENT_IDS,VOYAGE_STAMP_TOTAL} from '../sources/portfolio-groups.js';
import {DiscoveryStore} from '../sources/core/discovery.js';

const islands=portfolioGroups.map(group=>({...group}));
const schools=educationSchools(content);

test('education retains two structured, verified school records under the original learning story',()=>{
  assert.deepEqual(schools.map(s=>s.schoolId),['bu','cmu']);
  const [bu,cmu]=schools;
  assert.equal(bu.degree,'Bachelor of Arts in Computer Science and Mathematics');
  assert.equal(bu.degreeNote,'Double major');
  assert.equal(bu.period,'May 2022');
  assert.equal(bu.gpa,'3.53 / 4.0');
  assert.equal(cmu.degree,'Master of Information Systems Management');
  assert.equal(cmu.period,'December 2023');
  assert.equal(cmu.gpa,'3.61 / 4.0');
  assert.deepEqual(bu.topics,['Software engineering','Database systems','Full-stack development','Foundations of data science']);
  assert.deepEqual(cmu.topics,['Distributed systems','Machine learning','Database management','Web application development']);
  assert.deepEqual(directoryGroups(content,'education')[0].entries.map(e=>e.id),['learning']);
  assert.equal(CONTENT_IDS.length,9);
  assert.equal(VOYAGE_STAMP_TOTAL,13);
});

test('both complete school exhibits resolve the intended school and the same education camera island',()=>{
  for(const school of schools){
    const target=exhibitTarget({contentId:'learning',schoolId:school.schoolId,readFull:true},'education',content,islands);
    assert.equal(target.school,school);
    assert.equal(target.entry.id,'learning');
    assert.equal(target.group.id,'education');
    assert.equal(target.island.id,'education');
    assert.deepEqual(target,schoolTarget(school.schoolId,content,islands));
  }
  assert.equal(exhibitTarget({contentId:'research',schoolId:'bu',readFull:true},'projects',content,islands),null);
  assert.equal(exhibitTarget({contentId:'learning',schoolId:'unknown',readFull:true},'education',content,islands),null);
  assert.equal(schoolTarget('bu',[],islands),null);
  assert.equal(portfolioTarget('learning',content,islands).school,undefined,'legacy overview still contains both schools');
});

test('school detail HTML cannot mix degrees, GPA, dates or study topics from the other school',()=>{
  for(const school of schools){
    const other=schools.find(s=>s!==school),markup=educationDetail(school);
    for(const fact of [school.title,school.degree,school.period,school.gpa,...school.topics])assert.ok(markup.includes(fact),`${school.schoolId} includes ${fact}`);
    for(const fact of [other.title,other.degree,other.period,other.gpa])assert.equal(markup.includes(fact),false,`${school.schoolId} excludes ${fact}`);
    assert.match(markup,new RegExp(`data-school-detail="${school.schoolId}"`));
  }
});

test('directory cards expose both school actions directly and fallback includes all areas of study',()=>{
  const menu=educationCards(schools),fallback=educationCards(schools,{complete:true});
  assert.equal((menu.match(/data-school="/g)||[]).length,2);
  assert.match(menu,/data-school="bu"/);assert.match(menu,/data-school="cmu"/);
  assert.equal((menu.match(/View education<\/span>/g)||[]).length,2);
  for(const school of schools){
    for(const fact of [school.title,school.degree,school.period,school.gpa])assert.ok(menu.includes(fact));
    for(const topic of school.topics)assert.ok(fallback.includes(topic));
  }
  assert.equal((fallback.match(/class="school-topics"/g)||[]).length,2);
});

test('school renderers escape content values rather than inserting executable markup',()=>{
  const school={...schools[0],title:'<img src=x onerror=alert(1)>',degree:'A & B',topics:['<script>bad()</script>']};
  for(const markup of [educationCards([school],{complete:true}),educationDetail(school)]){
    assert.equal(markup.includes('<img'),false);assert.equal(markup.includes('<script>'),false);
    assert.ok(markup.includes('&lt;img'));assert.ok(markup.includes('A &amp; B'));
  }
});

test('reading both schools saves one viewed story without granting a visit or changing stamp totals',()=>{
  const store=new DiscoveryStore({storage:{getItem:()=>null,setItem(){}}});
  for(const school of schools)store.see(schoolTarget(school.schoolId,content,islands).entry.id);
  assert.deepEqual([...store.viewed],['learning']);
  assert.deepEqual([...store.viewedGroups],['education']);
  assert.equal(store.visited.size,0);assert.equal(store.ashore.size,0);assert.equal(store.stamps,0);
});
