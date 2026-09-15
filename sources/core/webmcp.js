// A navigation bridge: it invokes the same actions as the map and directory.
export function registerVoyageTools({islands,read,travel,status}){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const choices=islands.map(i=>i.id);
 for(const tool of [{name:'get_voyage_status',title:'Current voyage',description:'Read boat, race and island navigation status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return status();}},
 {name:'navigate_portfolio_island',title:'Explore a portfolio island',description:'Read an island’s portfolio content or travel to its safe harbor. Travel ends any active local race.',inputSchema:{type:'object',properties:{islandId:{type:'string',enum:choices},action:{type:'string',enum:['read','travel']}},required:['islandId','action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||!choices.includes(input.islandId)||!['read','travel'].includes(input.action))throw new Error('Choose a known island and read or travel.');if(input.action==='travel'){if(!status().available3D)throw new Error('Sea travel is unavailable; choose read.');await travel(input.islandId);}else read(input.islandId);return {islandId:input.islandId,action:input.action,...status()};}}]){
  try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 }
}
