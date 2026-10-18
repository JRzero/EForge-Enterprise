import './tree-list-layout.css';
import {useId, useState, type ReactNode} from 'react';
import {NativeButton} from './native';

/** Tree ownership, filtering and selection stay in the sidebar slot. */
export function TreeListLayout({sidebar, sidebarLabel, selectionLabel, children}: {
  sidebar: ReactNode; sidebarLabel: string; selectionLabel?: string; children: ReactNode;
}) {
  const id = useId(), [expanded,setExpanded] = useState(true);
  return <div className="tree-list-layout">
    <NativeButton className="tree-list-toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}>
      {expanded?'收起':'展开'}{sidebarLabel}{selectionLabel?` · ${selectionLabel}`:''}
    </NativeButton>
    <aside id={id} className="tree-list-sidebar" aria-label={sidebarLabel} data-collapsed={!expanded||undefined}>{sidebar}</aside>
    <div className="tree-list-content">{children}</div>
  </div>;
}
