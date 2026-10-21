import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import content from '../sources/content.json' with {type:'json'};
import {PanelHistory} from '../sources/core/panel-history.js';
import {portfolioGroups} from '../sources/portfolio-groups.js';
import {portfolioTarget,directoryGroups,educationSchools} from '../sources/core/portfolio-navigation.js';
import {educationCards} from '../sources/ui/education.js';
import {experienceOverview,experienceDetail,experienceCard} from '../sources/ui/experience.js';
import {initialExperienceView} from '../sources/core/experience-content.js';

const main=await fs.readFile(new URL('../sources/main.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../sources/index.html',import.meta.url),'utf8');
const panelSource=main.slice(main.indexOf('const panelInitialFocus='),main.indexOf('function openEducation('));
const directorySource=main.slice(main.indexOf('function openDirectory('),main.indexOf('function openMap('));
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
  const nodes=new Map(),calls=[],seen=new Set(),history=new PanelHistory();
  let generation=0;
  const document={activeElement:null,body:{classList:classList(),dataset:{}},hidden:false};
  const node=id=>{
    if(nodes.has(id))return nodes.get(id);
    let markup='',children=[];
    const element={id,open:false,hidden:false,scrollTop:0,isConnected:true,textContent:'',style:{},classList:classList(),dataset:{},
      focus(){document.activeElement=this;},closest(selector){return selector==='[hidden]'&&this.hidden?this:null;},
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
  let resolveInit,rejectInit;
  const ready=new Promise((resolve,reject)=>{resolveInit=resolve;rejectInit=reject;});
  class TestGame{
    constructor(){this.boat=null;this.frozen=false;this.handlers=new Map();this.events={on:(name,handler)=>this.handlers.set(name,handler)};this.renderer={setAnimationLoop(){}};}
    async init(){await ready;this.boat={};inputs.setEnabled(true);this.handlers.get('ready')?.('WebGL2');}
    pause(reason,focus){calls.push(['pause',reason,focus?.id]);this.frozen=true;inputs.setEnabled(false);}
    resume(reason){calls.push(['resume',reason]);this.frozen=false;inputs.setEnabled(true);}
    dock(focus){calls.push(['dock',focus?.id]);this.pause('dock',focus);}
    cancelExperienceDemo(){} cancelTravel(){} endSchoolRead(){}
  }
  const context=vm.createContext({game:null,fallbackGame:null,currentId:null,returnFocus:null,restoringPanel:false,travelToken:0,
    panelHistory:history,document,$:node,content,portfolioGroups,islands:portfolioGroups.map(group=>({...group})),
    portfolioTarget,directoryGroups,educationSchools,educationCards,experienceOverview,experienceDetail,experienceCard,initialExperienceView,
    contentFocus:id=>({id}),esc:escape,inputs,settings:{},store:{see:id=>seen.add(id)},TestGame,
    URLSearchParams,Promise,location:{search},console:{error(){}},installIcons(){},sound(){},toast(){},
    demoUI:{update(){},close(){},open(){}},
    frame(){},finished(){},openChallenge(){},openPractice(){},openTrainOptions(){},openExhibit(){},openStudio(){},syncZoom(){},reset(){},
  });
  vm.runInContext(panelSource+directorySource+fallbackSource+bootSource,context);
  return {context,node,document,inputs,calls,seen,history,
    run:source=>vm.runInContext(source,context),
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
