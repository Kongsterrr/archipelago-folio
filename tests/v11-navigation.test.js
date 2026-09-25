import test from 'node:test';
import assert from 'node:assert/strict';
import content from '../sources/content.json' with {type:'json'};
import {portfolioGroups,CONTENT_IDS,PHYSICAL_ISLAND_IDS,islandIdFor,VOYAGE_STAMP_TOTAL} from '../sources/portfolio-groups.js';
import {directoryGroups,portfolioTarget,exhibitEntry} from '../sources/core/portfolio-navigation.js';
import {DiscoveryStore,DISCOVERY_STORAGE_KEY,SECRETS,CHALLENGE_IDS} from '../sources/core/discovery.js';
import {createVoyageTools} from '../sources/core/webmcp.js';
const physicalIslands=portfolioGroups.map(group=>({...group,dock:{x:group.n*10,z:0}}));
function memory(initial={}){const data=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]));return {data,storage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}};}

test('four directory/fallback groups retain each of the nine source stories exactly once',()=>{
 const groups=directoryGroups(content);
 assert.deepEqual(groups.map(g=>g.id),['about','experience','projects','education']);
 assert.deepEqual(groups.map(g=>g.entries.length),[2,3,3,1]);
 assert.deepEqual(new Set(groups.flatMap(g=>g.entries.map(e=>e.id))),new Set(content.map(e=>e.id)));
 for(const group of groups){assert.deepEqual(directoryGroups(content,group.id).map(g=>g.id),[group.id]);for(const entry of group.entries)assert.equal(entry,content.find(e=>e.id===entry.id));}
 assert.deepEqual(directoryGroups(content,'project').map(g=>g.id),['projects'],'older project category still opens Projects');
 assert.equal(VOYAGE_STAMP_TOTAL,13);
});

test('parent overviews and legacy story links resolve independently to the correct physical destination',()=>{
 for(const group of portfolioGroups){const overview=portfolioTarget(group.id,content,physicalIslands);assert.equal(overview.entry,null);assert.equal(overview.island.id,group.id);assert.deepEqual(overview.entries.map(e=>e.id),group.entryIds);
  for(const id of group.entryIds){const target=portfolioTarget(id,content,physicalIslands);assert.equal(target.entry.id,id);assert.equal(target.island.id,group.id);assert.equal(islandIdFor(id),group.id);}
 }
 assert.equal(portfolioTarget('missing',content,physicalIslands),null);
 assert.equal(portfolioTarget('connect',content,physicalIslands).group.id,'about');
});

test('grouped exhibit events open the station story rather than looking up a nonexistent parent entry',()=>{
 assert.equal(exhibitEntry({contentId:'beaconfire',contentSection:'results'},'experience',content).id,'beaconfire');
 assert.equal(exhibitEntry({contentId:'research'},'projects',content).id,'research');
 assert.equal(exhibitEntry({},'amtrak',content).id,'amtrak','legacy exhibit payload remains readable');
 assert.equal(exhibitEntry({contentId:'missing'},'projects',content),null);
 assert.equal(exhibitEntry({},'experience',content),null,'parent IDs cannot silently choose an unrelated story');
});

test('V4 migration merges nine physical records into four while preserving nine granular viewed stories',()=>{
 const {storage,data}=memory({'jack-archipelago-v4':{version:4,settings:{livery:'graphite',quality:'low',sound:true,reduced:true,zoom:2,walkZoom:0},discovered:[...CONTENT_IDS,'unknown'],visited:CONTENT_IDS,ashore:CONTENT_IDS,viewed:CONTENT_IDS,seaLife:['shark','fish'],secrets:SECRETS.map(s=>s.id),completed:CHALLENGE_IDS,bests:{'buoy-v2':45000,'cargo-v2':78000,'buoy-v1':100}}});
 const store=new DiscoveryStore({storage});
 for(const kind of ['discovered','visited','ashore'])assert.deepEqual(new Set(store[kind]),new Set(PHYSICAL_ISLAND_IDS));
 assert.deepEqual(store.viewed,new Set(CONTENT_IDS));assert.deepEqual(store.viewedGroups,new Set(PHYSICAL_ISLAND_IDS));assert.equal(store.stamps,13);
 assert.deepEqual(store.settings,{livery:'graphite',quality:'low',sound:true,reduced:true,zoom:2,walkZoom:0});assert.deepEqual(store.seaLife,new Set(['shark','fish']));assert.equal(store.best('buoy'),45000);assert.equal(store.best('cargo'),78000);
 const saved=JSON.parse(data.get(DISCOVERY_STORAGE_KEY));assert.equal(saved.version,11);assert.deepEqual(new Set(saved.visited),new Set(PHYSICAL_ISLAND_IDS));assert.equal(saved.viewed.length,9);assert.equal(saved.bests['buoy-v1'],undefined);
});

test('V11 migration is idempotent and clearing records cannot revive old V2/V3/V4 history',()=>{
 const {storage,data}=memory({'jack-archipelago-v4':{visited:['amtrak','beaconfire','visionx'],ashore:['harbor','learning'],viewed:['research'],seaLife:['shark'],secrets:['bell'],completed:['buoy'],bests:{'buoy-v2':51000}}});
 const first=new DiscoveryStore({storage});const snapshot=data.get(DISCOVERY_STORAGE_KEY);const second=new DiscoveryStore({storage});assert.equal(data.get(DISCOVERY_STORAGE_KEY),snapshot);assert.equal(second.visited.size,1);
 first.clearLogbook();first.clearWalks();first.clearSeaLife();const third=new DiscoveryStore({storage});assert.equal(third.stamps,0);assert.equal(third.ashore.size,0);assert.equal(third.seaLife.size,0);assert.equal(third.viewed.size,0);assert.equal(third.best('buoy'),51000);
});

test('partial old schemas inherit missing settings and valid bests without undoing an explicit newer clear',()=>{
 const {storage}=memory({'jack-archipelago-v2':{settings:{sound:true,zoom:2,quality:'low'},viewed:['research'],visited:['harbor'],bests:{'cargo-v2':80000,'buoy-v2':50000}},'jack-archipelago-v3':{settings:{livery:'sunset'},seaLife:['turtle'],bests:{'buoy-v2':47000}},'jack-archipelago-v4':{settings:{walkZoom:0},visited:[],ashore:['amtrak']}});
 const store=new DiscoveryStore({storage});assert.equal(store.settings.sound,true);assert.equal(store.settings.zoom,2);assert.equal(store.settings.quality,'low');assert.equal(store.settings.livery,'sunset');assert.equal(store.settings.walkZoom,0);assert.equal(store.visited.size,0);assert.deepEqual([...store.ashore],['experience']);assert.ok(store.viewed.has('research'));assert.ok(store.seaLife.has('turtle'));assert.equal(store.best('buoy'),47000);assert.equal(store.best('cargo'),80000);
});

test('reading one story marks only that story and derives a group viewed state without granting a visit',()=>{
 const store=new DiscoveryStore({storage:memory().storage});assert.equal(store.see('experience'),false);store.see('amtrak');assert.ok(store.isViewed('experience'));assert.ok(store.isViewed('amtrak'));assert.equal(store.isViewed('beaconfire'),false);assert.deepEqual([...store.viewed],['amtrak']);assert.equal(store.visited.size,0);assert.equal(store.discovered.size,0);assert.equal(store.ashore.size,0);assert.equal(store.stamps,0);
});

test('port dwell and walking aliases share one physical stamp and reject unknown destinations',()=>{
 const store=new DiscoveryStore({storage:memory().storage});store.visit('amtrak',true,.6);store.visit('beaconfire',false,0);store.visit('experience',true,.6);assert.equal(store.visited.size,0);store.visit('visionx',true,.4);assert.deepEqual([...store.visited],['experience']);assert.equal(store.stamps,1);store.land('amtrak');store.land('visionx');assert.deepEqual([...store.ashore],['experience']);store.discover('unknown');store.visit('unknown',true,2);assert.equal(store.visited.size,1);assert.equal(store.discovered.size,1);
});

test('malformed or denied browser storage leaves grouped records and scores usable in memory',()=>{
 for(const storage of [{getItem(){throw Error('denied');},setItem(){throw Error('denied');}},{getItem(){return '{broken';},setItem(){throw Error('quota');}}]){const store=new DiscoveryStore({storage});store.see('connect');store.land('harbor');store.observe('dolphin');store.complete('cargo',74000);assert.equal(store.best('cargo'),74000);assert.ok(store.ashore.has('about'));assert.ok(store.viewed.has('connect'));assert.ok(store.seaLife.has('dolphin'));}
});

function toolFixture(available3D=true){const calls=[];const actions={islands:physicalIslands,status:()=>({available3D,panel:null,boat:{x:1,z:2}}),read:id=>calls.push(['read',id]),travel:async id=>calls.push(['travel',id]),close(){},play(){},interact(){},dock(){},steer(){},walk(){},board(){}};return {calls,tools:new Map(createVoyageTools(actions).map(tool=>[tool.name,tool]))};}

test('WebMCP advertises four physical islands and accepts all stable story IDs for read and travel',async()=>{
 const {calls,tools}=toolFixture(),navigate=tools.get('navigate_portfolio_island');assert.deepEqual(new Set(navigate.inputSchema.properties.islandId.enum),new Set([...PHYSICAL_ISLAND_IDS,...CONTENT_IDS]));
 for(const id of [...PHYSICAL_ISLAND_IDS,...CONTENT_IDS]){await navigate.execute({islandId:id,action:'read'});assert.deepEqual(calls.at(-1),['read',id]);await navigate.execute({islandId:id,action:'travel'});assert.deepEqual(calls.at(-1),['travel',islandIdFor(id)]);}
 const status=tools.get('get_voyage_status').execute();assert.equal(status.islands.length,4);assert.deepEqual(status.islands.find(i=>i.id==='experience').entryIds,['amtrak','beaconfire','visionx']);assert.equal(status.contentMapping.connect,'about');assert.equal(status.contentMapping.learning,'education');assert.equal(Object.keys(status.contentMapping).length,9);assert.deepEqual(status.boat,{x:1,z:2});
});

test('WebMCP fallback can read aliases but refuses travel and invalid IDs before invoking actions',async()=>{
 const {calls,tools}=toolFixture(false),navigate=tools.get('navigate_portfolio_island');await navigate.execute({islandId:'research',action:'read'});assert.deepEqual(calls,[['read','research']]);await assert.rejects(navigate.execute({islandId:'research',action:'travel'}),/unavailable/);await assert.rejects(navigate.execute({islandId:'missing',action:'read'}),/known island/);assert.equal(calls.length,1);
});
