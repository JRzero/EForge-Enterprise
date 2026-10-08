import {NativeButton, NativeInput} from '../../ui/native';
import {useState, type KeyboardEvent} from 'react';
import {Button} from '../../ui/controls';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {MenuIcon} from '../../features/menus/IconPicker';
import {navigationSearchPool, searchNavigation, type NavigationSearchEntry} from './navigation-search';

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
export function NavigationSearchContent({items,router,close,id}: {items: NavigationItem[]; router: AppRouterAdapter; close: ()=>void; id: string}) {
  const [query,setQuery] = useState(''); const [activeKey,setActiveKey] = useState<string|null>(null);
  const results = searchNavigation(navigationSearchPool(items),query);
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
  return <>
      <label>菜单搜索<NativeInput autoFocus role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id+'-results'}
        aria-activedescendant={activeIndex>=0?id+'-'+activeIndex:undefined} placeholder="支持标题、URL模糊查询" value={query}
        onChange={event=>{setQuery(event.target.value);setActiveKey(null);}} onKeyDown={keyboard} /></label>
      <Button label="清除搜索" variant="ghost" size="sm" onClick={()=>{setQuery('');setActiveKey(null);}} />
      <p role="status">找到 {results.length} 个结果</p>
      <div role="listbox" aria-label="导航搜索结果" id={id+'-results'} className="navigation-search-results">{results.map((item,index)=><div
        id={id+'-'+index} key={item.key} role="option" aria-selected={activeKey===item.key} onMouseEnter={()=>setActiveKey(item.key)}>
        <NativeButton type="button" aria-label={'打开 '+item.title.join(' / ')} onClick={()=>choose(item)}><MenuIcon name={item.icon} />
          <span><span><Highlight text={item.title.join(' / ')} query={query} /></span><small><Highlight text={item.href} query={query} /></small></span>{item.external?<span aria-label="在新窗口打开">↗</span>:null}</NativeButton>
      </div>)}</div>
      {!results.length?<p>未找到“{query}”相关菜单</p>:null}
      <p className="muted">↑ ↓ 切换 Enter 选择 Esc 关闭</p>
  </>;
}
