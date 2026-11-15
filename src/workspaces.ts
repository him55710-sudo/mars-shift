export const WORKSPACES = [
  {id:'home',page:'home',href:'/',name:'Mission Hub',short:'Hub',group:'Overview',description:'Your starting point for Mars.',icon:'orbit'},
  {id:'navigate',page:'navigate',href:'/navigate',name:'Field Navigation',short:'Navigate',group:'Mission',description:'DEM, ground candidates and sand-aware routes in one view.',icon:'route'},
  {id:'explore',page:'explore',href:'/explore',name:'Surface Explorer',short:'Explore',group:'Explore',description:'Walk recorded Perseverance terrain.',icon:'footprints'},
  {id:'navcam',page:'explore',href:'/explore?surface=navcam',name:'Navcam close-up',short:'Navcam',group:'Explore',description:'Inspect the calibrated camera footprint.',icon:'scan'},
  {id:'dem',page:'explore',href:'/explore?analysis=separation',name:'Surface & features',short:'Features',group:'Explore',description:'Separate measured relief and raised candidates.',icon:'layers'},
  {id:'terrain',page:'terrain',href:'/terrain',name:'Mars Atlas',short:'Atlas',group:'Explore',description:'Explore global imagery and rover panoramas.',icon:'globe'},
  {id:'plan',page:'plan',href:'/planning',name:'Mission Control',short:'Plan',group:'Mission',description:'Compare outbound and return routes.',icon:'route'},
  {id:'mission',page:'explore',href:'/explore?surface=mission',name:'EVA mission map',short:'EVA map',group:'Mission',description:'Rehearse your shared mission on orbital terrain.',icon:'compass'},
  {id:'destinations',page:'destinations',href:'/destinations',name:'Science destinations',short:'Destinations',group:'Mission',description:'Choose a region and science objective.',icon:'flag'},
  {id:'crew',page:'crew',href:'/crew',name:'Crew rehearsal',short:'Crew',group:'Mission',description:'Carry your plan through science and return.',icon:'users'},
  {id:'hazards',page:'hazards',href:'/hazards',name:'Weather & hazards',short:'Hazards',group:'Analysis',description:'Replay observations and rehearse changed conditions.',icon:'wind'},
  {id:'terrain-local',page:'terrain-local',href:'/terrain/analysis',name:'Terrain Lab',short:'Terrain Lab',group:'Analysis',description:'Inspect elevation, layers and local profiles.',icon:'mountain'},
  {id:'review',page:'review',href:'/review',name:'Evidence & demo',short:'Review',group:'Library',description:'Current validation, limits and demo entry points.',icon:'book'},
  {id:'evidence',page:'evidence',href:'/evidence',name:'Evidence & sources',short:'Evidence',group:'Library',description:'Trace observations, models and limitations.',icon:'book'},
  {id:'briefing',page:'briefing',href:'/briefing',name:'Project briefing',short:'Briefing',group:'Library',description:'Seven slides, with a PowerPoint download.',icon:'presentation'},
  {id:'about',page:'about',href:'/about',name:'About the mission',short:'About',group:'Library',description:'The science mission, out and back.',icon:'compass'},
] as const;
export type WorkspaceId = typeof WORKSPACES[number]['id'];
export const workspaceHref = (id:string) => WORKSPACES.find(w=>w.id===id)?.href ?? '/';
/** Resolve specific aliases before parent routes. Query parameters carry the surface view. */
export function resolveWorkspace(pathname:string, search=''):WorkspaceId|'not-found' {
  const path=pathname.replace(/\/+$/,'')||'/';
  if(path==='/terrain/local')return 'explore';
  if(path==='/explore') {
    const params=new URLSearchParams(search);
    if(params.get('surface')==='navcam')return 'navcam';
    if(params.get('surface')==='mission')return 'mission';
    if(['dem','separation','features'].includes(params.get('analysis')??''))return 'dem';
    return 'explore';
  }
  return WORKSPACES.find(w=>w.href.split('?')[0]===path)?.id??'not-found';
}
export function pageForWorkspace(id:string) {return WORKSPACES.find(w=>w.id===id)?.page??'not-found';}
export function isOrbitalSurface(search:string) {return ['navcam','mission'].includes(new URLSearchParams(search).get('surface')??'');}
export function shouldHandleLink(event:Pick<MouseEvent,'button'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>) {
  return event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey;
}
