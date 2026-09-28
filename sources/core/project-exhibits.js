export function exhibitRange(action,riding=false,retained=false){
 const expanded=!!action.station?.readFull;
 return (expanded?(riding?4.5:3):1.8)+(retained?(expanded ? .5 : .3):0);
}

export function selectLandExhibit(actions,position,{riding=false,previous=null,visible=()=>true}={}){
 return actions.filter(a=>(!riding||a.kind==='read'&&a.station?.readFull)&&a.distance(position)<=exhibitRange(a,riding,a===previous)&&visible(a)).sort((a,b)=>a.distance(position)-b.distance(position))[0]||null;
}

export function selectProjectSign(actions,position,visible){
 return actions.filter(a=>a.station?.primary&&a.distance(position)<=12&&visible(a)).sort((a,b)=>a.distance(position)-b.distance(position))[0]||null;
}
