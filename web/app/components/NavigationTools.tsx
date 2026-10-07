import {useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent} from 'react';
import {Button} from '@eforge/ui';
import type {AppRouterAdapter, AppRouteRecord, RouteMatch} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {MenuIcon} from '../../features/menus/IconPicker';
import {ResourceDialog} from './ResourceDialog';
import {navigationBreadcrumbs, navigationSearchPool, searchNavigation, type NavigationSearchEntry} from './navigation-model';
export function NavigationBreadcrumbs({items,routes,match,router}: {
  items: NavigationItem[]; routes: readonly AppRouteRecord[]; match: RouteMatch; router: AppRouterAdapter;
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); router.navigate(href);
  }
  return <nav aria-label="面包屑" className="enterprise-breadcrumbs"><ol>{navigationBreadcrumbs(items,routes,match).map((item,index,crumbs) => <li key={item.key}>
    {item.href ? <a href={item.href} aria-label={'面包屑：'+item.label} onClick={event=>navigate(event,item.href!)}>{item.label}</a> : <span aria-current={index===crumbs.length-1?'page':undefined}>{item.label}</span>}
  </li>)}</ol></nav>;
}
function Highlight({text,query}: {text:string;query:string}) {
  if (!query) return <>{text}</>;
  const parts = []; let start = 0;
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    parts.push(text.slice(start,index),<mark key={index}>{match[0]}</mark>); start=index+match[0].length;
  }
  return <>{parts}{text.slice(start)}</>;
}
function SearchDialog({items,router,close}: {items: NavigationItem[]; router: AppRouterAdapter; close: ()=>void}) {
  const [query,setQuery] = useState(''); const [activeKey,setActiveKey] = useState<string|null>(null);
  const id = useId(); const results = searchNavigation(navigationSearchPool(items),query);
  const activeIndex = results.findIndex(item=>item.key===activeKey);
  function choose(item: NavigationSearchEntry) {
    if (item.external) window.open(item.href,'_blank','noopener,noreferrer'); else router.navigate(item.href);
    close();
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (!results.length) return;
      const next = event.key==='ArrowDown' ? (activeIndex+1)%results.length : (activeIndex<=0?results.length:activeIndex)-1;
      setActiveKey(results[next]!.key);
      document.getElementById(id+'-'+next)?.scrollIntoView({block:'nearest'});
    } else if (event.key==='Enter' && activeIndex>=0) {event.preventDefault(); choose(results[activeIndex]!);}
  }
  return <ResourceDialog closeOnBackdrop titleId={id+'-title'} busy={false} onCancel={close}>
    <div className="navigation-search"><h2 id={id+'-title'}>导航搜索</h2>
      <label>菜单搜索<input autoFocus role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id+'-results'}
        aria-activedescendant={activeIndex>=0?id+'-'+activeIndex:undefined} placeholder="支持标题、URL模糊查询" value={query}
        onChange={event=>{setQuery(event.target.value);setActiveKey(null);}} onKeyDown={keyboard} /></label>
      <Button label="清除搜索" variant="ghost" size="sm" onClick={()=>{setQuery('');setActiveKey(null);}} />
      <p role="status">找到 {results.length} 个结果</p>
      <div role="listbox" aria-label="导航搜索结果" id={id+'-results'} className="navigation-search-results">{results.map((item,index)=><div
        id={id+'-'+index} key={item.key} role="option" aria-selected={activeKey===item.key} onMouseEnter={()=>setActiveKey(item.key)}>
        <button type="button" aria-label={'打开 '+item.title.join(' / ')} onClick={()=>choose(item)}><MenuIcon name={item.icon} />
          <span><span><Highlight text={item.title.join(' / ')} query={query} /></span><small><Highlight text={item.href} query={query} /></small></span>{item.external?<span aria-label="在新窗口打开">↗</span>:null}</button>
      </div>)}</div>
      {!results.length?<p>未找到“{query}”相关菜单</p>:null}
      <p className="muted">↑ ↓ 切换 Enter 选择 Esc 关闭</p><Button label="关闭搜索" onClick={close} />
    </div>
  </ResourceDialog>;
}
export function NavigationSearch({items,router}: {items: NavigationItem[]; router: AppRouterAdapter}) {
  const [open,setOpen] = useState(false); const trigger = useRef<HTMLSpanElement>(null);
  const priorOpen = useRef(false);
  useEffect(()=>{
    if (priorOpen.current && !open) trigger.current?.querySelector('button')?.focus();
    priorOpen.current = open;
  },[open]);
  function close() {setOpen(false);}
  return <><span ref={trigger}><Button label="导航搜索" variant="ghost" size="sm" onClick={()=>setOpen(true)} /></span>
    {open?<SearchDialog items={items} router={router} close={close} />:null}</>;
}