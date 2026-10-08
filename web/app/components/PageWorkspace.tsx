import {Activity, Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {canAccessRoute, getRouteAncestry, matchAppRoute, type AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {routes} from '../routes';
import {useApplicationControls, ApplicationControlsContext} from '../context';
import {MenuIcon} from '../../features/menus/IconPicker';
import {useLayout,useLayoutChanges} from './layout-preferences';
import {Button} from '@eforge/ui';
import {ResourceDialog} from './ResourceDialog';
import {PageErrorBoundary} from './PageErrorBoundary';

interface View {path:string;href:string;title:string;routeId:string;cached:boolean;affix:boolean;icon?:string;revision:number}
type CloseMode='current'|'others'|'left'|'right'|'all';
type PendingExit = {pages: View[]; action: '关闭' | '刷新' | '重新加载应用'; proceed: () => void};
// The authenticated owner can keep its native listener outside the screen-lock Activity.
export interface PageUnloadGuard {shouldBlock: () => boolean}
function menu(items:NavigationItem[],path:string):NavigationItem|undefined {
  for(const item of items){if(!item.external && item.path===path)return item;const child=menu(item.children,path);if(child)return child;}
}
function view(href:string,items:NavigationItem[],permissions:readonly string[]):View|undefined {
  try {
  const url=new URL(href,'http://eforge.local');if(url.origin!=='http://eforge.local')return;const path=url.pathname==='/'?'/dashboard':url.pathname;
  const match=matchAppRoute(routes,path);if(!match || !canAccessRoute(match.route,permissions))return;
  const ancestry=getRouteAncestry(routes,match.route.id);
  const own=menu(items,match.route.path);
  const preference=own ?? ancestry.map(route=>menu(items,route.path)).filter(Boolean).at(-1);
  return {path,href:path+url.search+url.hash,title:own?.label ?? match.route.title,routeId:match.route.id,cached:preference?.cached ?? true,
    affix:path==='/dashboard',icon:own?.icon,revision:0};
  } catch {return;}
}
function visit(views:View[],entry:View|undefined):View[] {
  if(!entry)return views;
  const prior=views.find(item=>item.path===entry.path);
  return prior ? views.map(item=>item.path===entry.path?{...entry,revision:item.revision}:item) : [...views,entry];
}
function retain(views:View[],target:View,mode:CloseMode):View[] {
  const index=views.findIndex(item=>item.path===target.path);
  return views.filter((item,position)=>item.affix || (mode==='current'?item.path!==target.path:mode==='others'?item.path===target.path:
    mode==='left'?position>=index:mode==='right'?position<=index:false));
}
export function PageWorkspace({href,items,permissions,router,fallback,ownerId,unloadGuard}: {
  href:string;items:NavigationItem[];permissions:readonly string[];router:AppRouterAdapter;fallback:ReactNode;ownerId:string;unloadGuard?:PageUnloadGuard;
}) {
  const layout=useLayout(),changeLayout=useLayoutChanges();
  const controls=useApplicationControls();
  const active=view(href,items,permissions);
  const storageKey='eforge.enterprise.page-tabs.v1.'+ownerId;
  const [saved]=useState<{enabled:boolean;hrefs:string[]}>(()=>{
    try{
      const raw=window.localStorage.getItem(storageKey);if(!raw || raw.length>2_000_000)return {enabled:false,hrefs:[]};
      const data:unknown=JSON.parse(raw);
      if(!data || typeof data!=='object' || !('enabled' in data) || data.enabled!==true || !('hrefs' in data) || !Array.isArray(data.hrefs))return {enabled:false,hrefs:[]};
      return {enabled:true,hrefs:data.hrefs.filter((item):item is string=>typeof item==='string' && item.length<=4096)};
    }catch{return {enabled:false,hrefs:[]};}
  });
  const [persist,setPersist]=useState(saved.enabled);
  useEffect(()=>{if(layout.tagsViewPersist===undefined)changeLayout?.(current=>({...current,tagsViewPersist:saved.enabled}));else setPersist(layout.tagsViewPersist);},[layout.tagsViewPersist,saved.enabled,changeLayout]);
  const [state,setState]=useState(()=>({href,views:visit(saved.hrefs.reduce((prior,item)=>visit(prior,view(item,items,permissions)),visit([],view('/dashboard',items,permissions))),active)}));
  // Adjust during rendering so the newly visited page is present before paint.
  if(state.href!==href)setState({href,views:visit(state.views,active)});
  const views=state.href===href?state.views:visit(state.views,active);
  const [selected,setSelected]=useState<string|null>(null);
  // These refs survive both individual page hiding and the outer screen-lock Activity.
  const dirtyPages = useRef(new Set<string>());
  const savingPages = useRef(new Set<string>());
  const [, updateSaveGuards] = useState(0);
  const confirmedReload = useRef(false);
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null);
  const [fullscreen,setFullscreen]=useState(false);
  const [menuPoint,setMenuPoint]=useState<{x:number;y:number}|undefined>();
  const menuElement=useRef<HTMLDivElement>(null);
  const strip=useRef<HTMLDivElement>(null),workspace=useRef<HTMLDivElement>(null);
  const [scroll,setScroll]=useState({left:false,right:false});
  const target=views.find(item=>item.path===(selected ?? active?.path));
  useEffect(() => {
    const shouldBlock = () => !confirmedReload.current && (dirtyPages.current.size > 0 || savingPages.current.size > 0);
    if (unloadGuard) {
      unloadGuard.shouldBlock = shouldBlock;
      // Activity cleans effects when locked. The owner-scoped guard must remain bound
      // so hidden write acknowledgements still update the decision through these refs.
      return;
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!shouldBlock()) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [unloadGuard]);
  // Browser back/forward can navigate even while a native confirmation dialog is open.
  useEffect(() => {setPendingExit(null);}, [href]);
  useEffect(()=>{
    try{if(persist)window.localStorage.setItem(storageKey,JSON.stringify({enabled:true,hrefs:state.views.filter(item=>!item.affix).map(item=>item.href)}));
    else window.localStorage.removeItem(storageKey);}catch{/* Private-mode/storage restrictions do not prevent navigation. */}
  },[persist,state.views,storageKey]);
  useEffect(()=>{
    const element=strip.current;if(!element)return;
    function update(){if(element)setScroll({left:element.scrollLeft>1,right:element.scrollLeft+element.clientWidth<element.scrollWidth-1});}
    update();const observer=new ResizeObserver(update);observer.observe(element);element.addEventListener('scroll',update);
    return ()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[state.views.length]);
  useEffect(()=>{
    const item=strip.current?.querySelector('[aria-current="page"]');item?.scrollIntoView({block:'nearest',inline:'nearest'});
  },[href]);
  useEffect(()=>{
    if(!fullscreen)return;
    const shell=workspace.current?.closest('.ef-app-shell');shell?.classList.add('enterprise-page-fullscreen');
    function escape(event:KeyboardEvent){if(event.key==='Escape')setFullscreen(false);}
    document.addEventListener('keydown',escape);
    return ()=>{shell?.classList.remove('enterprise-page-fullscreen');document.removeEventListener('keydown',escape);};
  },[fullscreen]);
  useEffect(()=>{
    if(!selected)return;
    menuElement.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function close(){setSelected(null);}
    document.addEventListener('click',close);
    return ()=>document.removeEventListener('click',close);
  },[selected]);
  function protect(pages: View[], action: PendingExit['action'], proceed: () => void) {
    const changed = pages.filter(item => dirtyPages.current.has(item.path) || savingPages.current.has(item.path));
    setSelected(null);
    const complete = () => {
      // Check the entire batch before removing any tag, including hidden Activities.
      if (pages.some(item => savingPages.current.has(item.path))) return;
      pages.forEach(item => {dirtyPages.current.delete(item.path); savingPages.current.delete(item.path);});
      proceed();
    };
    if (changed.length) setPendingExit({pages: changed, action, proceed: complete});
    else complete();
  }
  function close(target:View,mode:CloseMode){
    const remaining=retain(views,target,mode);
    protect(views.filter(item => !remaining.includes(item)), '关闭', () => {
      setState({href,views:remaining});
      if(mode==='others')router.navigate(target.href);
      else if(active && !remaining.some(item=>item.path===active.path))router.navigate(remaining.at(-1)?.href ?? '/dashboard');
    });
  }
  function refresh(target:View){
    protect([target], '刷新', () => {
      setState({href,views:views.map(item=>item.path===target.path?{...item,revision:item.revision+1}:item)});
      if(target.path!==active?.path)router.navigate(target.href);
    });
  }
  function closePage(target: View, destination: string) {
    const remaining = views.filter(item => item.affix || item.path !== target.path);
    protect(views.filter(item => !remaining.includes(item)), '关闭', () => {
      setState({href, views: remaining});
      router.navigate(destination);
    });
  }
  function reloadApplication() {
    protect(views, '重新加载应用', () => {
      // The application confirmation already covered every retained draft.
      confirmedReload.current = true;
      window.location.reload();
    });
  }
  function keyboard(event:React.KeyboardEvent<HTMLAnchorElement>,index:number){
    const links=strip.current?.querySelectorAll<HTMLAnchorElement>('a');
    const next=event.key==='ArrowRight'?(index+1)%views.length:event.key==='ArrowLeft'?(index+views.length-1)%views.length:
      event.key==='Home'?0:event.key==='End'?views.length-1:undefined;
    if(next!==undefined){event.preventDefault();links?.[next]?.focus();}
  }
  const exitSaving = pendingExit?.pages.some(item=>savingPages.current.has(item.path)) ?? false;
  const exitDirty = pendingExit?.pages.some(item=>dirtyPages.current.has(item.path)) ?? false;
  return <div ref={workspace} className="enterprise-workspace">
    <nav hidden={!layout.tagsView} aria-label="页面标签" className="page-tags">
      <button type="button" aria-label="滚动到首个标签" disabled={!scroll.left} onClick={()=>strip.current?.scrollTo({left:0,behavior:'smooth'})}>‹</button>
      <div ref={strip} className="page-tags-strip">{views.map((item,index)=><span key={item.path} className="page-tag">
        <a href={item.href} aria-label={"页面标签："+item.title} aria-current={active?.path===item.path?'page':undefined} onKeyDown={event=>keyboard(event,index)}
          onClick={event=>{if(!event.button&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();router.navigate(item.href);setSelected(null);}}}
          onAuxClick={event=>{if(event.button===1){event.preventDefault();if(!item.affix)close(item,'current');}}}
          onContextMenu={event=>{event.preventDefault();setMenuPoint({x:Math.max(8,Math.min(event.clientX,window.innerWidth-170)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-300))});setSelected(item.path);}}>
          {layout.tagsIcon ? <MenuIcon name={item.icon}/> : null}{item.title}{item.affix?<span aria-label="固定标签">●</span>:null}
        </a>{!item.affix?<button type="button" aria-label={'关闭标签 '+item.title} onClick={()=>close(item,'current')}>×</button>:null}
      </span>)}</div>
      <button type="button" aria-label="滚动到末个标签" disabled={!scroll.right} onClick={()=>strip.current?.scrollTo({left:strip.current.scrollWidth,behavior:'smooth'})}>›</button>
      <button type="button" aria-label="标签操作" aria-expanded={!!selected} onClick={event=>{event.stopPropagation();setMenuPoint(undefined);setSelected(selected?null:active?.path ?? views[0]?.path ?? null);}}>⌄</button>
      <button type="button" aria-label="刷新当前页面" disabled={!active} onClick={()=>{const current=views.find(item=>item.path===active?.path);if(current)refresh(current);}}>刷新</button>
      <label className="page-tags-persist"><input type="checkbox" checked={persist} onChange={event=>{setPersist(event.target.checked);changeLayout?.(current=>({...current,tagsViewPersist:event.target.checked}));}}/>记住标签</label>
    </nav>
    {selected && target?<div ref={menuElement} role="menu" aria-label="标签操作菜单" className="page-tag-menu" style={menuPoint?{position:"fixed",left:menuPoint.x,top:menuPoint.y,right:"auto"}:undefined} onKeyDown={event=>{if(event.key==='Escape'){setSelected(null);strip.current?.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement),step=event.key==='ArrowDown'?1:-1;
        buttons[(index+step+buttons.length)%buttons.length]?.focus();
      }}}>
      <button role="menuitem" onClick={()=>refresh(target)}>刷新页面</button>
      {!target.affix?<button role="menuitem" onClick={()=>close(target,'current')}>关闭当前</button>:null}
      <button role="menuitem" onClick={()=>close(target,'others')}>关闭其他</button>
      <button role="menuitem" disabled={!views.slice(0,views.indexOf(target)).some(item=>!item.affix)} onClick={()=>close(target,'left')}>关闭左侧</button>
      <button role="menuitem" disabled={!views.slice(views.indexOf(target)+1).some(item=>!item.affix)} onClick={()=>close(target,'right')}>关闭右侧</button>
      <button role="menuitem" onClick={()=>close(target,'all')}>全部关闭</button>
      <button role="menuitem" onClick={()=>{setFullscreen(value=>!value);setSelected(null);}}>{fullscreen?'退出全屏':'全屏显示'}</button>
    </div>:null}
    {!active?fallback:null}
    {views.filter(item=>item.cached || item.path===active?.path || dirtyPages.current.has(item.path) || savingPages.current.has(item.path)).map(item=>{
      const match=matchAppRoute(routes,item.path);if(!match || !canAccessRoute(match.route,permissions))return null;
      const Page=match.route.component;
      return <Activity key={item.path+':'+item.revision} mode={item.path===active?.path?'visible':'hidden'}>
        <ApplicationControlsContext.Provider value={{...controls,href:item.path===active?.path?href:item.href,
          closePage:destination=>closePage(item,destination),
          setPageDirty:(dirty,pendingSave=false)=>{
            if(dirty)dirtyPages.current.add(item.path);else dirtyPages.current.delete(item.path);
            const changed=savingPages.current.has(item.path)!==pendingSave;
            if(pendingSave)savingPages.current.add(item.path);else savingPages.current.delete(item.path);
            if(changed)updateSaveGuards(version=>version+1);
          }}}>
          <div data-page-path={item.path}>
            <PageErrorBoundary title={item.title} onRetry={()=>refresh(item)} onReload={reloadApplication}>
              <Suspense fallback={<p role="status">正在加载页面…</p>}><Page params={match.params}/></Suspense>
            </PageErrorBoundary>
          </div>
        </ApplicationControlsContext.Provider>
      </Activity>;
    })}
    {pendingExit ? <ResourceDialog titleId="page-exit-title" alert busy={false} onCancel={()=>setPendingExit(null)}>
      <h2 id="page-exit-title">{exitSaving ? '正在保存修改' : exitDirty ? '有未保存的修改' : '修改已保存'}</h2>
      <p>{exitSaving
        ? '请等待保存结果，再关闭或刷新页面。'
        : exitDirty ? `${pendingExit.pages.map(item=>item.title).join('、')}中有未保存的修改，是否放弃并${pendingExit.action}？` : '保存已完成，可以继续操作。'}</p>
      <div className="post-row-actions">
        <Button label="继续编辑" onClick={()=>{const destination=pendingExit.pages[0]?.href;setPendingExit(null);if(destination)router.navigate(destination);}} />
        <Button label={(exitDirty || exitSaving ? '放弃修改并' : '继续')+pendingExit.action} variant="secondary" isDisabled={exitSaving} onClick={()=>{
          if(pendingExit.pages.some(item=>savingPages.current.has(item.path)))return;
          const proceed=pendingExit.proceed;setPendingExit(null);proceed();
        }} />
      </div>
    </ResourceDialog> : null}
  </div>;
}
