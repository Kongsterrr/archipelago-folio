// Local, deterministic illustrations. These presets are not employer systems,
// production rules, live recommendations, messages or generated AI answers.
export const EXPERIENCE_DEMO_DURATION=8;
const step=(label,detail)=>({label,detail});
export const EXPERIENCE_DEMOS={
 visionx:{title:'Personalization Garden',presets:[
  {id:'low-light',label:'Low-light room',steps:[step('Preference','Choose a low-light room.'),step('Profile','Compare the example light preference.'),step('Match','Select the low-light sample.'),step('Recommendation','Show the match and its reason.')],result:'The low-light sample matches this example room preference. A short explanation makes the recommendation understandable.'},
  {id:'sunny-balcony',label:'Sunny balcony',steps:[step('Preference','Choose a sunny balcony.'),step('Profile','Compare the example light preference.'),step('Match','Select the sun-loving sample.'),step('Recommendation','Show the match and its reason.')],result:'The sun-loving sample matches this example balcony preference. The same flow adapts to a different profile.'}
 ]},
 beaconfire:{title:'Connected Services Bench',presets:[
  {id:'subscription',label:'Send a subscription',steps:[step('Request','A sample subscription enters the service.'),step('Queue','The service places a message on a queue.'),step('Delivery','A worker handles the queued message.'),step('Result','Show a simulated delivery confirmation.')],result:'The sample request becomes a queued message and a simulated delivery. No email is sent.'},
  {id:'retrieval',label:'Find an answer',steps:[step('Question','Example question: where is the station guide?'),step('Retrieve','Find the matching sample document.'),step('Context','Use the document excerpt as context.'),step('Answer','Display an answer with its example source.')],result:'Example answer: “The guide is beside the station entrance.” Source: sample visitor guide, section 1. This answer is a preset illustration.'}
 ]},
 amtrak:{title:'Workforce Workflow Desk',presets:[
  {id:'valid',label:'Valid submission',steps:[step('Posting','Open a fictional posting.'),step('Submission','Create one sample submission.'),step('Validation','Check the example submission.'),step('Pending','Accept the sample into a pending state.')],result:'The valid sample enters a pending state after validation. The posting, checks and states are illustrative, not Amtrak business rules.'},
  {id:'duplicate',label:'Duplicate submission',steps:[step('Posting','Open the same fictional posting.'),step('Submission','Try a second copy of the sample.'),step('Validation','Detect the example duplicate.'),step('Blocked','Keep the existing submission unchanged.')],result:'The duplicate sample is blocked, leaving the original unchanged. This illustrates data integrity, not Amtrak business rules.'}
 ]}
};
export const experiencePreset=(companyId,presetId)=>EXPERIENCE_DEMOS[companyId]?.presets?.find(p=>p.id===presetId)||null;

// Owned by the physical island controller, never by a disposable GLB/district.
// Only the game's fixed simulation loop advances time.
export class ExperienceDemoController{
 constructor(){this.cancel();}
 open(companyId){
  const definition=EXPERIENCE_DEMOS[companyId];if(!definition?.presets)return false;
  this.companyId=companyId;this.presetId=definition.presets[0].id;this.elapsed=0;this.status='choosing';return true;
 }
 play(companyId,presetId,{reduced=false}={}){
  if(!experiencePreset(companyId,presetId))return false;
  this.companyId=companyId;this.presetId=presetId;this.elapsed=reduced?EXPERIENCE_DEMO_DURATION:0;this.status=reduced?'complete':'playing';return true;
 }
 step(dt,{paused=false,reduced=false}={}){
  if(this.status!=='playing'||paused)return;
  if(reduced)this.elapsed=EXPERIENCE_DEMO_DURATION;
  else if(Number.isFinite(dt)&&dt>0)this.elapsed=Math.min(EXPERIENCE_DEMO_DURATION,this.elapsed+dt);
  if(this.elapsed>=EXPERIENCE_DEMO_DURATION-1e-9){this.elapsed=EXPERIENCE_DEMO_DURATION;this.status='complete';}
 }
 cancel(){const changed=this.status&&this.status!=='idle';this.companyId=null;this.presetId=null;this.elapsed=0;this.status='idle';return !!changed;}
 snapshot({paused=false}={}){
  const preset=experiencePreset(this.companyId,this.presetId),progress=this.elapsed/EXPERIENCE_DEMO_DURATION;
  return {companyId:this.companyId,presetId:this.presetId,status:this.status,stage:preset?Math.min(preset.steps.length-1,Math.floor(progress*preset.steps.length)):0,elapsed:this.elapsed,duration:EXPERIENCE_DEMO_DURATION,progress,paused:!!paused};
 }
}
