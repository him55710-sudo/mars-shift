import {describe,expect,it} from 'vitest';
import {WORKSPACES,isOrbitalSurface,pageForWorkspace,resolveWorkspace,shouldHandleLink,workspaceHref} from './workspaces';
describe('workspace navigation contract',()=>{
 it('round-trips every published view, including the three explorer subviews',()=>{
  for(const w of WORKSPACES){const url=new URL(workspaceHref(w.id),'https://example.test');expect(resolveWorkspace(url.pathname,url.search)).toBe(w.id);expect(pageForWorkspace(w.id)).toBe(w.page);}
 });
 it('keeps analysis and local explorer aliases distinct from the global Atlas',()=>{
  expect(resolveWorkspace('/terrain/analysis/')).toBe('terrain-local');expect(resolveWorkspace('/terrain/local')).toBe('explore');expect(resolveWorkspace('/terrain')).toBe('terrain');
 });
 it('derives the renderer from the destination query when going back between surface views',()=>{
  for(const [query,id,orbital] of [['?surface=navcam','navcam',true],['?analysis=separation','dem',false],['?surface=mission','mission',true],['','explore',false]] as const){expect(resolveWorkspace('/explore',query)).toBe(id);expect(isOrbitalSurface(query)).toBe(orbital);}
 });
 it('does not silently open a crew rehearsal for an unknown URL',()=>{expect(resolveWorkspace('/missing')).toBe('not-found');expect(pageForWorkspace('not-found')).toBe('not-found');});
 it('leaves browser new-tab and modified-link behavior intact',()=>{
  const plain={button:0,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false};expect(shouldHandleLink(plain)).toBe(true);
  expect(shouldHandleLink({...plain,button:1})).toBe(false);for(const key of ['ctrlKey','metaKey','altKey','shiftKey'])expect(shouldHandleLink({...plain,[key]:true})).toBe(false);
 });
});
