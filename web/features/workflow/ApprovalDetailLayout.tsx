import {useState, type ReactNode} from 'react';
import {DetailTabs} from '../../ui/TabbedDetailPage';

/** Workflow-local presentation; business permissions and commands stay in the page. */
export function ApprovalDetailLayout({summary, tasks, history, actions}: {summary:ReactNode;tasks:ReactNode;history:ReactNode;actions?:ReactNode}) {
  const [tab,setTab]=useState('request');
  return <><DetailTabs label="审批详情页签" value={tab} onChange={setTab} tabs={[
    {key:'request',label:'申请与任务',content:<>{summary}{tasks}</>},
    {key:'history',label:'处理记录',content:history},
  ]}/>{actions}</>;
}
