export function exhibitRange(action,riding=false,retained=false){
 const expanded=!!action.station?.readFull;
 return (expanded?(riding?4.5:3):1.8)+(retained?(expanded ? .5 : .3):0);
}

export function selectLandExhibit(actions,position,{riding=false,previous=null,visible=()=>true}={}){
 // Individual directory rows are pointer targets; the overview owns its E/F action.
 return actions.filter(a=>!a.station?.directory&&(!riding||a.kind==='read'&&a.station?.readFull)&&a.distance(position)<=exhibitRange(a,riding,a===previous)&&visible(a)).sort((a,b)=>a.distance(position)-b.distance(position))[0]||null;
}

export function exhibitReadLabel(action){
 return action?.station?.directoryOverview||action?.station?.directory?'Browse projects':action?.station?.readFull?'View project':action?.label||'Read exhibit';
}

// Dispatch and the on-screen E button share this priority, including overlapping exhibits.
export function landPrimaryAction({player,canRideQuad,canBoard,nearStation}){
 if(player.ridingQuad)return {kind:'dismount',label:'Dismount quad bike'};
 if(!player.walking)return null;
 if(canRideQuad)return {kind:'mount',label:'Ride quad bike'};
 if(nearStation?.kind==='read'&&nearStation.station?.readFull)return {kind:'read',label:exhibitReadLabel(nearStation)};
 if(canBoard)return {kind:'board',label:'Board boat'};
 if(nearStation?.kind==='read')return {kind:'read',label:exhibitReadLabel(nearStation)};
 return null;
}

export function selectProjectSign(actions,position,visible){
 return actions.filter(a=>a.station?.primary&&a.distance(position)<=12&&visible(a)).sort((a,b)=>a.distance(position)-b.distance(position))[0]||null;
}
