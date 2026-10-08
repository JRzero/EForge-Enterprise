import {useId, useRef, useState, type MouseEvent, type ReactNode} from 'react';

export interface FrontendNavigationItem {id: string; title: string; href: string}
export interface FrontendLayoutProps {
  brand: ReactNode; navigation: readonly FrontendNavigationItem[]; activeHref?: string;
  actions?: ReactNode; footer?: ReactNode; children: ReactNode;
  onNavigate?: (href: string) => void;
}

/** Public-facing layout, independent of admin tabs, cache and session contexts. */
export function FrontendLayout({brand, navigation, activeHref, actions, footer, children, onNavigate}: FrontendLayoutProps) {
  const [open,setOpen]=useState(false), navigationId=useId(), toggle=useRef<HTMLButtonElement>(null);
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    setOpen(false);
    if(onNavigate){event.preventDefault();onNavigate(href);}
  }
  return <div className="enterprise-layout frontend-layout">
    <a className="frontend-skip-link" href="#frontend-content">跳到主要内容</a>
    <header className="frontend-header"><div className="frontend-header-inner">
      <div className="frontend-brand">{brand}</div>
      <button ref={toggle} type="button" className="frontend-menu-toggle" aria-label="前台导航菜单" aria-expanded={open} aria-controls={navigationId} onClick={()=>setOpen(value=>!value)}>☰</button>
      <nav id={navigationId} className="frontend-navigation" aria-label="前台导航" data-open={open} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);toggle.current?.focus();}}}>
        {navigation.map(item=><a key={item.id} href={item.href} aria-current={item.href===activeHref?'page':undefined} onClick={event=>navigate(event,item.href)}>{item.title}</a>)}
      </nav><div className="frontend-header-actions">{actions}</div>
    </div></header>
    <main id="frontend-content" className="frontend-content" tabIndex={-1}>{children}</main>
    {footer ? <footer className="frontend-footer">{footer}</footer> : null}
  </div>;
}
