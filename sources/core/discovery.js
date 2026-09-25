import {CONTENT_IDS,PHYSICAL_ISLAND_IDS,islandIdFor,groupFor} from '../portfolio-groups.js';
export {VOYAGE_STAMP_TOTAL} from '../portfolio-groups.js';
export const ISLAND_IDS = PHYSICAL_ISLAND_IDS;
export const DISCOVERY_STORAGE_KEY = 'jack-archipelago-v11';
export const SECRETS = [
  {id:'bottle',title:'Hello, world.',hint:'A small message near the welcome channel.'},
  {id:'duck',title:'Harbor master',hint:'Make a little splash with a yellow neighbour.'},
  {id:'bell',title:'All aboard',hint:'Ring in a new voyage at Jack’s Harbor.'},
  {id:'arch',title:'Under the arch',hint:'Look for a stone passage north-east of the central bay.'},
  {id:'cove',title:'A quiet corner',hint:'There is more coast behind the garden.'},
  {id:'signal',title:'Across the bay',hint:'A little signal from the About island.'}
];
export const CHALLENGE_IDS = ['buoy','cargo','lighthouse'];
export const COURSE_KEYS = {buoy:'buoy-v2',cargo:'cargo-v2'};
const SEA_IDS=['dolphin','shark','fish','turtle'];
const clean=(list,allowed)=>new Set(Array.isArray(list)?list.filter(id=>allowed.includes(id)):[]);
const physical=list=>new Set((Array.isArray(list)?list:[]).map(islandIdFor).filter(Boolean));

export class DiscoveryStore {
  constructor({storage, defaults={}, onChange=()=>{}}={}) {
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    this.onChange = onChange;
    const current=this.read(DISCOVERY_STORAGE_KEY),legacy=['v2','v3','v4'].map(version=>this.read('jack-archipelago-'+version));
    // An existing V11 record is authoritative, including intentionally cleared arrays.
    // For earlier records, newest defined fields win; missing newer fields inherit.
    const saved=current.version===11?current:Object.assign({},...legacy);
    const prefs=current.version===11?(current.settings||{}):Object.assign({},this.read('jack-archipelago-v1'),...legacy.map(record=>record.settings));
    this.settings={sound:typeof prefs.sound==='boolean'?prefs.sound:false,quality:prefs.quality==='low'?'low':prefs.quality==='high'?'high':defaults.quality||'high',reduced:typeof prefs.reduced==='boolean'?prefs.reduced:!!defaults.reduced,zoom:[0,1,2].includes(prefs.zoom)?prefs.zoom:1,walkZoom:[0,1,2].includes(prefs.walkZoom)?prefs.walkZoom:1,livery:['marina','sunset','graphite'].includes(prefs.livery)?prefs.livery:'marina'};
    this.ashore=physical(saved.ashore);
    this.seaLife=clean(saved.seaLife,SEA_IDS);
    this.discovered=physical(saved.discovered);
    this.visited=physical(saved.visited);
    // Story reading stays granular: reading Amtrak never marks BeaconFire read.
    this.viewed=clean(saved.viewed,CONTENT_IDS);
    this.secrets=clean(saved.secrets,SECRETS.map(s=>s.id));
    this.completed=clean(saved.completed,CHALLENGE_IDS);
    this.bests={};
    for(const record of current.version===11?[current]:legacy)for(const key of Object.values(COURSE_KEYS)){const time=record.bests?.[key];if(Number.isFinite(time)&&time>0&&(!this.bests[key]||time<this.bests[key]))this.bests[key]=time;}
    this.dwell=new Map();
    this.save();
  }
  read(key){try {const value=JSON.parse(this.storage?.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return{};}}
  save(){try{this.storage?.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify({version:11,ashore:[...this.ashore],settings:this.settings,seaLife:[...this.seaLife],discovered:[...this.discovered],visited:[...this.visited],viewed:[...this.viewed],secrets:[...this.secrets],completed:[...this.completed],bests:this.bests}));}catch{/* The in-memory voyage remains usable. */}}
  mark(kind,id){const set=this[kind];if(!(set instanceof Set)||set.has(id))return false;set.add(id);this.save();this.onChange({kind,id});return true;}
  observe(id){return SEA_IDS.includes(id)&&this.mark('seaLife',id);}
  land(id){const island=islandIdFor(id);return !!island&&this.mark('ashore',island);}
  clearWalks(){this.ashore.clear();this.save();this.onChange({kind:'walkReset'});}
  clearSeaLife(){this.seaLife.clear();this.save();this.onChange({kind:'seaReset'});}
  see(id){return CONTENT_IDS.includes(id)&&this.mark('viewed',id);}
  isViewed(id){const group=groupFor(id);return CONTENT_IDS.includes(id)?this.viewed.has(id):!!group&&group.entryIds.some(entry=>this.viewed.has(entry));}
  get viewedGroups(){return new Set(PHYSICAL_ISLAND_IDS.filter(id=>this.isViewed(id)));}
  discover(id){const island=islandIdFor(id);return !!island&&this.mark('discovered',island);}
  visit(id,inside,dt){const island=islandIdFor(id);if(!island)return false;if(!inside){this.dwell.delete(island);return false;}if(!Number.isFinite(dt)||dt<=0)return false;const dwell=(this.dwell.get(island)||0)+dt;this.dwell.set(island,dwell);if(dwell>=1){this.discover(island);return this.mark('visited',island);}return false;}
  secret(id){return SECRETS.some(s=>s.id===id)&&this.mark('secrets',id);}
  complete(id,time){if(!CHALLENGE_IDS.includes(id))return;const key=COURSE_KEYS[id];if(key&&Number.isFinite(time)&&time>0&&(!this.bests[key]||time<this.bests[key]))this.bests[key]=time;this.mark('completed',id);this.save();return this.best(id);}
  best(id){return this.bests[COURSE_KEYS[id]]||0;}
  clearLogbook(){for(const kind of ['discovered','visited','viewed','secrets','completed'])this[kind].clear();this.dwell.clear();this.save();this.onChange({kind:'reset'});}
  get stamps(){return this.visited.size+this.secrets.size+this.completed.size;}
}
