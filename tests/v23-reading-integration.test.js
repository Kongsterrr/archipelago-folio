import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import content from '../sources/content.json' with {type:'json'};
import {PanelHistory} from '../sources/core/panel-history.js';
import {portfolioGroups} from '../sources/portfolio-groups.js';
import {islands,contentFocus} from '../sources/config.js';
import {portfolioTarget,directoryGroups,educationSchools,schoolTarget} from '../sources/core/portfolio-navigation.js';
import {educationCards,educationDetail} from '../sources/ui/education.js';
import {experienceOverview,experienceDetail,experienceCard} from '../sources/ui/experience.js';
import {initialExperienceView} from '../sources/core/experience-content.js';

const main=await fs.readFile(new URL('../sources/main.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../sources/index.html',import.meta.url),'utf8');
const panelSource=main.slice(main.indexOf('const panelInitialFocus='),main.indexOf('function openLandmark('));
const directorySource=main.slice(main.indexOf('function openDirectory('),main.indexOf('function openMap('));
const navigationSource=main.slice(main.indexOf("document.addEventListener('click',"),main.indexOf("document.addEventListener('change',"));
const menuSource=main.slice(main.indexOf("$('#browse-button').onclick="),main.indexOf("$('#helm-button').onclick="));
const fallbackSource=main.slice(main.indexOf('function enableFallback('),main.indexOf("$('#back-to-sea').onclick="));
const bootSource=main.slice(main.indexOf('async function boot('),main.indexOf('// Resolve a shared reading link once'))
  .replace("await import('./game.js')",'await Promise.resolve({Game:TestGame})');
const sharedSource=main.slice(main.indexOf('const sharedExperience='),main.indexOf('\nboot();'));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function classList(){
  const values=new Set();
  return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},contains:name=>values.has(name),toggle(name,value){value??=!values.has(name);value?values.add(name):values.delete(name);return value;}};
}

// Run the actual main.js route and lifecycle functions with a deferred 3D
// dependency. DOM state is deliberately persistent across the asynchronous wait.
function fixture(search=''){
  const nodes=new Map(),listeners=new Map(),calls=[],seen=new Set(),history=new PanelHistory();
  let generation=0;
  const document={activeElement:null,body:{classList:classList(),dataset:{}},hidden:false,addEventListener:(name,handler)=>listeners.set(name,handler)};
  const node=id=>{
    if(nodes.has(id))return nodes.get(id);
    let markup='',children=[];
    const element={id,open:false,hidden:false,scrollTop:0,isConnected:true,textContent:'',style:{},classList:classList(),dataset:{},
      focus(){document.activeElement=this;},closest(selector){if(selector==='button,a')return ['BUTTON','A'].includes(this.tagName)?this:null;return selector==='[hidden]'&&this.hidden?this:null;},
      showModal(){this.open=true;calls.push(['show',id]);},close(){this.open=false;},
      addEventListener(){},querySelectorAll(){return children;},
      querySelector(selector){const match=selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);return match?children.find(child=>child.dataset[match[1]]===match[2])||null:null;},
      append(child){children.push(child);child.parent=this;},removeChild(child){children=children.filter(item=>item!==child);child.isConnected=false;},remove(){this.parent?.removeChild(this);},
      get innerHTML(){return markup;},set innerHTML(value){
        children.forEach(child=>child.isConnected=false);markup=value;
        children=[...value.matchAll(/<(button|a|summary)\b([^>]*)>/g)].map((match,index)=>{
          const child=node(`${id}:generation${generation++}:${index}`);child.parent=this;
          child.tagName=match[1].toUpperCase();
          for(const attribute of match[2].matchAll(/data-([a-z-]+)="([^"]*)"/g))child.dataset[attribute[1]]=attribute[2];
          return child;
        });
        if(id==='#panel-content')node('#panel-content .experience-links').innerHTML=value.includes('experience-links')?value.slice(value.indexOf('<div class="panel-links experience-links"')):'';
      }};
    nodes.set(id,element);return element;
  };
  document.activeElement=node('#homepage-trigger');
  document.querySelector=node;
  document.createElement=tag=>{const element=node(`created:${tag}:${generation++}`);element.tagName=tag.toUpperCase();return element;};
  const inputs={enabled:true,setEnabled(value){this.enabled=value;},clear(){calls.push(['clear-input']);}};
  let resolveInit,rejectInit,resolveStarted;
  const ready=new Promise((resolve,reject)=>{resolveInit=resolve;rejectInit=reject;});
  const started=new Promise(resolve=>{resolveStarted=resolve;});
  class TestGame{
    constructor(){this.boat=null;this.frozen=false;this.handlers=new Map();this.events={on:(name,handler)=>this.handlers.set(name,handler)};this.renderer={setAnimationLoop:loop=>{this.animationLoop=loop;}};resolveStarted(this);}
    async init(){await ready;this.boat={};inputs.setEnabled(true);this.renderer.setAnimationLoop(()=>{});this.handlers.get('ready')?.('WebGL2');}
    pause(reason,focus){calls.push(['pause',reason,focus?.id]);this.focus=focus;this.frozen=true;inputs.setEnabled(false);}
    resume(reason){calls.push(['resume',reason]);this.frozen=false;inputs.setEnabled(true);}
    dock(focus){calls.push(['dock',focus?.id]);this.pause('dock',focus);}
    cancelExperienceDemo(){} cancelTravel(){} endSchoolRead(){}
  }
  const context=vm.createContext({game:null,fallbackGame:null,currentId:null,returnFocus:null,restoringPanel:false,travelToken:0,
    panelHistory:history,document,$:node,content,portfolioGroups,islands,
    portfolioTarget,directoryGroups,educationSchools,schoolTarget,educationCards,educationDetail,experienceOverview,experienceDetail,experienceCard,initialExperienceView,
    contentFocus,esc:escape,inputs,settings:{},store:{see:id=>seen.add(id)},TestGame,
    URLSearchParams,Promise,location:{search},console:{error(){}},installIcons(){},sound(){},toast(){},
    demoUI:{update(){},close(){},open(){}},
    frame(){},finished(){},openChallenge(){},openPractice(){},openTrainOptions(){},openExhibit(){},openStudio(){},openSettings(){},openGames(){},syncZoom(){},reset(){},
  });
  vm.runInContext(panelSource+directorySource+navigationSource+menuSource+fallbackSource+bootSource,context);
  return {context,node,document,inputs,calls,seen,history,started,
    run:source=>vm.runInContext(source,context),
    click:element=>listeners.get('click')({target:element}),
    share:()=>vm.runInContext(sharedSource,context),
    boot:()=>vm.runInContext('boot()',context),
    ready:resolveInit,fail:rejectInit};
}

test('V23 all Experience entry routes render the same overview and stay one history level',()=>{
  const f=fixture();
  for(const call of ["openDirectory('experience')","openGroup('experience')","openEntry('experience')"]){
    f.run(call);
    assert.equal(f.context.currentId,'experience');
    assert.equal(f.node('#panel-content').innerHTML,experienceOverview(content));
    assert.equal(f.node('#panel-back').hidden,true);
    assert.equal(f.history.stack.length,0);
  }
  assert.equal(f.seen.size,0,'overview does not claim that individual jobs have been read');
});

test('all four header categories open their island reading view in one click, with or without 3D',async()=>{
  const navigation=html.match(/<nav aria-label="Portfolio navigation">([\s\S]*?)<\/nav>/)[1];
  const categories=[...navigation.matchAll(/data-category="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(new Set(categories),new Set(portfolioGroups.map(group=>group.id)));
  for(const available3D of [true,false])for(const id of categories){
    const f=fixture(available3D?'':'?no3d');
    if(available3D)f.run('game=new TestGame();game.boat={}');else await f.boot();
    const trigger=Object.assign(f.node(`#header-${id}`),{tagName:'BUTTON',dataset:{category:id}});
    trigger.focus();f.click(trigger);
    const markup=f.node('#panel-content').innerHTML;
    assert.equal(f.context.currentId,id==='education'?'learning':id);
    assert.equal(f.node('#panel').open,true);
    assert.equal(f.node('#panel-back').hidden,true);
    assert.equal(f.history.stack.length,0);
    assert.doesNotMatch(markup,/Island overview|directory-groups/);
    assert.equal(f.inputs.enabled,false);
    if(available3D){
      assert.deepEqual(f.context.game.focus,contentFocus(id),'the first click frames the whole selected island');
      assert.equal(f.context.game.frozen,true);
      assert.match(markup,new RegExp(`data-travel="${id}"`));
    }else assert.doesNotMatch(markup,/data-travel=/);
    f.click(trigger);
    assert.equal(f.history.stack.length,0,'opening the same island twice does not add a redundant Back step');
    f.run('closePanel()');
    assert.equal(f.document.activeElement,trigger);
  }
  const legacy=fixture();legacy.run("openDirectory('project')");
  assert.equal(legacy.context.currentId,'projects','legacy singular category keeps the direct overview route');
});

test('island story and school details return to the overview with its camera, scroll and selected control',()=>{
  const routes=[
    {island:'about',attribute:'open',detail:'harbor'},
    {island:'projects',attribute:'open',detail:'research'},
    {island:'experience',attribute:'open',detail:'beaconfire'},
    {island:'education',attribute:'school',detail:'bu'},
  ];
  for(const route of routes){
    const f=fixture();f.run('game=new TestGame();game.boat={}');
    f.run(`openDirectory('${route.island}')`);
    const card=f.node('#panel-content').querySelectorAll().find(node=>node.dataset[route.attribute]===route.detail);
    assert.ok(card);card.focus();f.node('#panel').scrollTop=184;f.click(card);
    assert.equal(f.context.currentId,route.attribute==='school'?`school:${route.detail}`:route.detail);
    assert.equal(f.history.stack.length,1);
    assert.equal(f.node('#panel-back').hidden,false);
    assert.equal(f.context.game.focus.exhibit,true,'details retain their specific reading focus');
    f.run('backPanel()');
    assert.equal(f.context.currentId,route.island==='education'?'learning':route.island);
    assert.equal(f.node('#panel').scrollTop,184);
    assert.equal(f.document.activeElement.dataset[route.attribute],route.detail);
    assert.deepEqual(f.context.game.focus,contentFocus(route.island));
    assert.equal(f.node('#panel-back').hidden,true);
  }
});

test('Browse and mobile menus keep all islands and expose each overview through its group heading',async()=>{
  for(const triggerId of ['#browse-button','#mobile-menu']){
    const f=fixture();f.node(triggerId).onclick();
    assert.equal(f.context.currentId,'directory');
    assert.equal(f.history.current.key,'directory:all');
    const markup=f.node('#panel-content').innerHTML;
    assert.doesNotMatch(markup,/Island overview/);
    for(const group of portfolioGroups){
      assert.match(markup,new RegExp(`data-portfolio-group="${group.id}"`));
      const heading=f.node('#panel-content').querySelectorAll().find(node=>node.dataset.open===group.id);
      assert.ok(heading);heading.focus();f.node('#panel').scrollTop=200;f.click(heading);
      assert.equal(f.context.currentId,group.id==='education'?'learning':group.id);
      f.run('backPanel()');
      assert.equal(f.context.currentId,'directory');
      assert.equal(f.node('#panel').scrollTop,200);
      assert.equal(f.document.activeElement.dataset.open,group.id);
    }
    for(const id of ['harbor','connect','amtrak','beaconfire','visionx','affirmation','research','catering'])assert.match(markup,new RegExp(`data-open="${id}"`));
    for(const id of ['bu','cmu'])assert.match(markup,new RegExp(`data-school="${id}"`));
  }
  const fallback=fixture('?no3d');await fallback.boot();
  assert.doesNotMatch(fallback.node('#fallback-cards').innerHTML,/Island overview/);
  for(const group of portfolioGroups){
    const heading=fallback.node('#fallback-cards').querySelectorAll().find(node=>node.dataset.open===group.id);
    assert.ok(heading);fallback.click(heading);
    assert.equal(fallback.context.currentId,group.id==='education'?'learning':group.id);
    assert.doesNotMatch(fallback.node('#panel-content').innerHTML,/data-travel=/);
    fallback.run('closePanel()');
  }
});

test('V23 direct company links create a real overview predecessor and Back restores it',()=>{
  for(const view of ['amtrak','beaconfire','visionx']){
    const f=fixture(`?view=${view}`);f.share();
    assert.equal(f.context.currentId,view);assert.equal(f.node('#panel').open,true);
    assert.deepEqual([...f.seen],[view]);assert.equal(f.history.stack.length,1);
    assert.equal(f.history.stack[0].key,'experience');assert.equal(f.node('#panel-back').hidden,false);
    assert.equal(f.document.activeElement,f.node('#panel-back'));
    f.run('backPanel()');
    assert.equal(f.context.currentId,'experience');assert.equal(f.node('#panel-back').hidden,true);
    assert.equal(f.document.activeElement,f.node('#panel-close'));
  }
});

test('V23 overview to detail to Back restores the selected company and scroll position',()=>{
  const f=fixture();f.run("openDirectory('experience')");
  const card=f.node('#panel-content').querySelectorAll().find(node=>node.dataset.open==='beaconfire');
  card.focus();f.node('#panel').scrollTop=184;
  f.run("openEntry('beaconfire')");f.run('backPanel()');
  assert.equal(f.node('#panel').scrollTop,184);
  assert.equal(f.document.activeElement.dataset.open,'beaconfire');
  assert.equal(f.context.currentId,'experience');
  f.run('closePanel()');
  assert.equal(f.document.activeElement,f.node('#homepage-trigger'));
  assert.equal(f.history.stack.length,0);
});

test('V23 four share targets open before 3D and remain usable through no-3D fallback',async()=>{
  assert.ok(main.indexOf('if(sharedExperience)openEntry(sharedExperience);')<main.indexOf('\nboot();'));
  for(const view of ['experience','amtrak','beaconfire','visionx']){
    const f=fixture(`?no3d&view=${view}`);f.share();const markup=f.node('#panel-content').innerHTML;
    await f.boot();
    assert.equal(f.context.currentId,view);assert.equal(f.node('#panel').open,true);
    assert.equal(f.node('#panel-content').innerHTML,markup);
    assert.equal(f.context.game,null);assert.equal(f.document.body.classList.contains('no-3d'),true);
    assert.match(markup,/href="\/resume\.pdf"/);assert.doesNotMatch(markup,/data-travel=/);
  }
});

test('an overview opened before or during initialization keeps its intended camera without rerendering',async()=>{
  for(const timing of ['before-boot','during-init'])for(const {id} of portfolioGroups){
    const f=fixture();
    if(timing==='before-boot')f.run(`openDirectory('${id}')`);
    const boot=f.boot();await f.started;
    if(timing==='during-init')f.run(`openDirectory('${id}')`);
    const markup=f.node('#panel-content').innerHTML,current=f.history.current;
    const selected=f.node('#panel-content').querySelectorAll()[0];selected.focus();
    f.node('#panel').scrollTop=137;f.ready();await boot;
    assert.deepEqual(f.context.game.focus,contentFocus(id));
    assert.equal(f.node('#panel-content').innerHTML,markup);
    assert.equal(f.document.activeElement,selected);
    assert.equal(selected.isConnected,true);
    assert.equal(f.node('#panel').scrollTop,137);
    assert.equal(f.history.current,current);
    assert.equal(f.history.stack.length,0);
    assert.equal(f.calls.filter(call=>call[0]==='show').length,1);
    assert.equal(f.inputs.enabled,false);
  }
});

test('delayed readiness uses the latest restored overview or exhibit focus rather than an earlier route',async()=>{
  const restored=fixture();restored.run("openDirectory('about')");
  const restoredBoot=restored.boot();await restored.started;
  restored.run("openDirectory('education');openSchool('bu');backPanel()");
  const current=restored.history.current,predecessors=restored.history.stack.length;
  restored.ready();await restoredBoot;
  assert.deepEqual(restored.context.game.focus,contentFocus('education'));
  assert.equal(restored.history.current,current);
  assert.equal(restored.history.stack.length,predecessors);
  assert.equal(restored.context.currentId,'learning');

  const exhibit=fixture();const exhibitBoot=exhibit.boot();await exhibit.started;
  exhibit.run("openEntry('research',{exhibitFocus:{id:'projects',contentId:'research',exhibit:true,x:5,y:6,z:7,camera:{distance:16}}})");
  const intended=exhibit.history.current.cameraFocus;
  exhibit.ready();await exhibitBoot;
  assert.equal(exhibit.context.game.focus,intended);
  assert.equal(exhibit.context.game.focus.camera.distance,16);
  assert.equal(exhibit.context.currentId,'research');
});

test('a superseded initialization cannot resume rendering or apply its camera after fallback',async()=>{
  const f=fixture();const boot=f.boot();await f.started;
  f.run("openDirectory('about')");const abandonedGame=f.context.game;
  f.run('enableFallback(false)');
  const current=f.history.current,markup=f.node('#panel-content').innerHTML;
  f.ready();await boot;
  assert.equal(f.context.game,null);
  assert.equal(abandonedGame.animationLoop,null);
  assert.equal(f.inputs.enabled,false);
  assert.equal(f.document.body.classList.contains('no-3d'),true);
  assert.equal(f.document.body.dataset.renderer,undefined);
  assert.equal(f.history.current,current);
  assert.equal(f.node('#panel-content').innerHTML,markup);
  assert.equal(f.calls.some(call=>call[0]==='pause'),false);
});

test('choosing fallback while the scene module is loading prevents scene initialization',async()=>{
  const f=fixture();const boot=f.boot();
  f.run("openDirectory('projects');enableFallback(false)");
  f.ready();await boot;
  assert.equal(f.context.game,null);
  assert.equal(f.context.currentId,'projects');
  assert.equal(f.inputs.enabled,false);
  assert.equal(f.document.body.dataset.renderer,undefined);
  assert.equal(f.calls.some(call=>call[0]==='pause'),false);
});

test('V23 closing an initial link while 3D is pending never reopens a stale panel',async()=>{
  for(const view of ['experience','amtrak','beaconfire','visionx']){
    const f=fixture(`?view=${view}`);f.share();const boot=f.boot();
    await Promise.resolve();f.run('closePanel()');f.ready();await boot;
    assert.equal(f.node('#panel').open,false);assert.equal(f.context.currentId,null);
    assert.equal(f.history.current,null);assert.equal(f.inputs.enabled,true);
    assert.equal(f.calls.some(call=>call[0]==='pause'),false);
    assert.equal(f.calls.some(call=>call[0]==='dock'),false);
  }
});

test('V23 readiness adds Travel in place without replacing a shared panel or moving focus',async()=>{
  for(const view of ['experience','amtrak','beaconfire','visionx']){
    const f=fixture(`?view=${view}`);f.share();const boot=f.boot();
    await Promise.resolve();const markup=f.node('#panel-content').innerHTML;
    const focus=f.document.activeElement;f.node('#panel').scrollTop=110;
    f.ready();await boot;
    assert.equal(f.context.currentId,view);assert.equal(f.node('#panel-content').innerHTML,markup);
    assert.equal(f.document.activeElement,focus);assert.equal(f.node('#panel').scrollTop,110);
    assert.deepEqual(f.context.game.focus,contentFocus(view));
    const links=f.node('#panel-content .experience-links'),travel=links.querySelector('[data-travel="experience"]');
    assert.ok(travel);assert.equal(travel.textContent,view==='experience'?'Travel here':'Travel to Experience');
    f.run('syncExperienceTravel()');
    assert.equal(links.querySelectorAll().filter(node=>node.dataset.travel==='experience').length,1);
    f.run('enableFallback()');
    assert.equal(links.querySelector('[data-travel="experience"]'),null,'renderer failure removes only the obsolete 3D action');
    assert.equal(f.context.currentId,view);assert.equal(f.node('#panel').open,true);
  }
});

test('V23 asynchronous readiness preserves the currently chosen menu instead of the URL target',async()=>{
  const f=fixture('?view=amtrak');f.share();const boot=f.boot();
  await Promise.resolve();f.run("openDirectory('all')");const markup=f.node('#panel-content').innerHTML;
  f.node('#panel').scrollTop=72;const focus=f.node('#panel-close');focus.focus();
  f.ready();await boot;
  assert.equal(f.context.currentId,'directory');assert.equal(f.node('#panel-content').innerHTML,markup);
  assert.equal(f.node('#panel').scrollTop,72);assert.equal(f.document.activeElement,focus);
  assert.equal(f.context.game.focus,null,'a generic menu clears the earlier career camera request');
  assert.equal(f.inputs.enabled,false);assert.equal(f.context.game.frozen,true);
  assert.equal(f.calls.filter(call=>call[0]==='show').length,1,'ready does not close/reopen the dialog');
});

test('V23 initialization failure keeps an already open career detail readable',async()=>{
  const f=fixture('?view=visionx');f.share();const boot=f.boot();
  await Promise.resolve();f.fail(new Error('Renderer unavailable'));await boot;
  assert.equal(f.context.currentId,'visionx');assert.equal(f.node('#panel').open,true);
  assert.equal(f.document.body.classList.contains('no-3d'),true);
  assert.match(f.node('#panel-content').innerHTML,/Improved user engagement by 15%/);
  f.run('backPanel()');assert.equal(f.context.currentId,'experience');
});

test('V23 unknown or absent sharing targets leave normal homepage entry untouched',()=>{
  for(const search of ['','?view=unknown','?view=constructor','?no3d']){
    const f=fixture(search);f.share();
    assert.equal(f.node('#panel').open,false);assert.equal(f.context.currentId,null);
    assert.equal(f.node('.intro').classList.contains('compact'),false);
  }
  assert.match(html,/id="helm-button"[^>]*>Take the helm/);
  assert.match(html,/id="browse-button"[^>]*>Browse my work/);
});
