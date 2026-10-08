import {useEffect, useId, useRef, useState, type MouseEvent} from 'react';
import {Button} from '@eforge/ui';
import type {AppRouterAdapter, AppRouteRecord, RouteMatch} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {ResourceDialog} from './ResourceDialog';
import {navigationBreadcrumbs} from './navigation-model';
import {DeferredFeature} from './DeferredFeature';
const loadSearch = () => import('./NavigationSearchContent').then(module => ({default: module.NavigationSearchContent}));
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
export function NavigationSearch({items,router}: {items: NavigationItem[]; router: AppRouterAdapter}) {
  const id = useId();
  const [open,setOpen] = useState(false); const trigger = useRef<HTMLSpanElement>(null);
  const priorOpen = useRef(false);
  useEffect(()=>{
    if (priorOpen.current && !open) trigger.current?.querySelector('button')?.focus();
    priorOpen.current = open;
  },[open]);
  function close() {setOpen(false);}
  return <><span ref={trigger}><Button label="导航搜索" variant="ghost" size="sm" onClick={()=>setOpen(true)} /></span>
    {open?<ResourceDialog closeOnBackdrop titleId={id+'-title'} busy={false} onCancel={close}>
      <div className="navigation-search"><h2 id={id+'-title'}>导航搜索</h2>
        <DeferredFeature load={loadSearch} componentProps={{items,router,close,id}}
          fallback={<p role="status">正在加载搜索…</p>}
          errorFallback={retry => <div role="alert"><p>搜索暂时无法加载，请重试或关闭后继续工作。</p><Button label="重试搜索加载" onClick={retry} /></div>} />
        <Button label="关闭搜索" onClick={close} />
      </div>
    </ResourceDialog>:null}</>;
}