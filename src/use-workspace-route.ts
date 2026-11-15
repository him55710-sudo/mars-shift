import {useCallback,useEffect,useState} from 'react';
import {isOrbitalSurface,pageForWorkspace,resolveWorkspace,workspaceHref} from './workspaces';
const read=()=>({pathname:location.pathname,search:location.search});
export function useWorkspaceRoute() {
 const [route,setRoute]=useState(read);
 useEffect(()=>{const sync=()=>setRoute(read());addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync);},[]);
 const navigate=useCallback((id:string)=>{history.pushState(null,'',workspaceHref(id));setRoute(read());window.scrollTo(0,0);},[]);
 const workspace=resolveWorkspace(route.pathname,route.search);
 return {workspace,page:pageForWorkspace(workspace),orbital:isOrbitalSurface(route.search),locationKey:route.pathname+route.search,navigate};
}
