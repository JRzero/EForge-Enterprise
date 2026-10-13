import {useId, type ReactNode} from 'react';
import {PageTabs} from './PageTabs';
import {DetailPage} from './DetailPage';

export type DetailTab = {key: string; label: string; content: ReactNode; disabled?: boolean};
export type DetailTabsProps = {label: string; tabs: DetailTab[]; value: string; onChange: (value: string)=>void};
/** Panels stay mounted; callers retain their own fetch and draft lifetimes. */
export function DetailTabs({label, tabs, value, onChange}: DetailTabsProps) {
  const id=useId();
  const active=tabs.some(tab=>tab.key===value&&!tab.disabled)?value:tabs.find(tab=>!tab.disabled)?.key;
  const items=tabs.map((tab,index)=>({...tab,value:tab.key,id:`${id}-tab-${index}`,panelId:`${id}-panel-${index}`}));
  return <div className="detail-tabs">
    <PageTabs label={label} items={items} value={active??''} onChange={onChange}/>
    {items.map(tab=><div className="detail-tab-panel" key={tab.key} id={tab.panelId} role="tabpanel" aria-labelledby={tab.id} hidden={tab.key!==active} tabIndex={0}>{tab.content}</div>)}
  </div>;
}

export function TabbedDetailPage({title, description, actions, ...props}: DetailTabsProps & {title:string;description?:string;actions?:ReactNode}) {
  return <DetailPage title={title} description={description} actions={actions}><DetailTabs {...props}/></DetailPage>;
}
