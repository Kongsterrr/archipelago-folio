export const ISLAND_IDS = ['harbor','amtrak','beaconfire','visionx','affirmation','research','catering','learning','connect'];
export const SECRETS = [
  {id:'bottle',title:'Hello, world.',hint:'A small message near the welcome channel.',icon:'✉'},
  {id:'duck',title:'Harbor master',hint:'Make a little splash with a yellow neighbour.',icon:'◉'},
  {id:'bell',title:'All aboard',hint:'Ring in a new voyage at Jack’s Harbor.',icon:'♧'},
  {id:'arch',title:'Under the arch',hint:'Look for a stone passage in the north-west.',icon:'∩'},
  {id:'cove',title:'A quiet corner',hint:'There is more coast behind the garden.',icon:'❋'},
  {id:'signal',title:'Across the bay',hint:'A little signal from Connect Island.',icon:'⌁'}
];
export const CHALLENGE_IDS = ['buoy','cargo','lighthouse'];
export const COURSE_KEYS = {buoy:'buoy-v2',cargo:'cargo-v2'};

export class DiscoveryStore {
  constructor({storage, defaults={}, onChange=()=>{}}={}) {
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    this.onChange = onChange;
    const v3=this.read('jack-archipelago-v3'),saved=Object.keys(v3).length?v3:this.read('jack-archipelago-v2'),old=this.read('jack-archipelago-v1');
    const prefs=saved.settings||old;
    this.settings={sound:typeof prefs.sound==='boolean'?prefs.sound:false,quality:prefs.quality==='low'?'low':prefs.quality==='high'?'high':defaults.quality||'high',reduced:typeof prefs.reduced==='boolean'?prefs.reduced:!!defaults.reduced,zoom:[0,1,2].includes(prefs.zoom)?prefs.zoom:1};
    const clean=(list,allowed)=>new Set(Array.isArray(list)?list.filter(id=>allowed.includes(id)):[]);
    this.seaLife=clean(saved.seaLife,['dolphin','shark','fish','turtle']);
    this.settings.livery=['marina','sunset','graphite'].includes(prefs.livery)?prefs.livery:'marina';
    this.discovered=clean(saved.discovered,ISLAND_IDS);
    this.visited=clean(saved.visited,ISLAND_IDS);
    this.viewed=clean(saved.viewed,ISLAND_IDS);
    this.secrets=clean(saved.secrets,SECRETS.map(s=>s.id));
    this.completed=clean(saved.completed,CHALLENGE_IDS);
    this.bests={};
    for(const key of Object.values(COURSE_KEYS)) if(Number.isFinite(saved.bests?.[key])&&saved.bests[key]>0)this.bests[key]=saved.bests[key];
    this.dwell=new Map();
  }
  read(key){try {const value=JSON.parse(this.storage?.getItem(key)||'{}');return value&&typeof value==='object'?value:{};}catch{return{};}}
  save(){try{this.storage?.setItem('jack-archipelago-v3',JSON.stringify({version:3,settings:this.settings,seaLife:[...this.seaLife],discovered:[...this.discovered],visited:[...this.visited],viewed:[...this.viewed],secrets:[...this.secrets],completed:[...this.completed],bests:this.bests}));}catch{/* The in-memory voyage remains usable. */}}
  mark(kind,id){const set=this[kind];if(!(set instanceof Set)||set.has(id))return false;set.add(id);this.save();this.onChange({kind,id});return true;}
  observe(id){return ['dolphin','shark','fish','turtle'].includes(id)&&this.mark('seaLife',id);}
  clearSeaLife(){this.seaLife.clear();this.save();this.onChange({kind:'seaReset'});}
  see(id){return ISLAND_IDS.includes(id)&&this.mark('viewed',id);}
  discover(id){return ISLAND_IDS.includes(id)&&this.mark('discovered',id);}
  visit(id,inside,dt){if(!inside){this.dwell.delete(id);return false;}const dwell=(this.dwell.get(id)||0)+dt;this.dwell.set(id,dwell);if(dwell>=1){this.discover(id);return this.mark('visited',id);}return false;}
  secret(id){return SECRETS.some(s=>s.id===id)&&this.mark('secrets',id);}
  complete(id,time){if(!CHALLENGE_IDS.includes(id))return;const key=COURSE_KEYS[id];if(key&&Number.isFinite(time)&&time>0&&(!this.bests[key]||time<this.bests[key]))this.bests[key]=time;this.mark('completed',id);this.save();return this.best(id);}
  best(id){return this.bests[COURSE_KEYS[id]]||0;}
  clearLogbook(){for(const kind of ['discovered','visited','viewed','secrets','completed'])this[kind].clear();this.dwell.clear();this.save();this.onChange({kind:'reset'});}
  get stamps(){return this.visited.size+this.secrets.size+this.completed.size;}
}
