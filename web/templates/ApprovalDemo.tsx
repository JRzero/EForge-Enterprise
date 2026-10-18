import {useState} from 'react';
import {ApprovalDetailLayout} from '../features/workflow/ApprovalDetailLayout';
import {AuditTimeline,Button,DetailPage,DetailSection,DetailField} from '../ui';

export function ApprovalDemo(){
  const [complete,setComplete]=useState(false);
  return <DetailPage title="请假审批示例" description="仅演示审批详情布局，处理结果保存在当前页面。">
    <ApprovalDetailLayout summary={<DetailSection title="申请信息"><DetailField label="申请人">林小禾</DetailField><DetailField label="状态">{complete?'已批准':'待审批'}</DetailField><DetailField label="请假事由">个人事务</DetailField></DetailSection>}
      tasks={<DetailSection title="当前任务"><DetailField label="部门审批">{complete?'流程已结束':'等待主管处理'}</DetailField></DetailSection>}
      history={<AuditTimeline label="示例审批记录" events={[{key:'submit',action:'林小禾提交申请',actor:'账号 9007199254740993',occurredAt:'2026-10-01T09:00:00+08:00',comment:'仅演示记录，不连接真实审批。'},...(complete?[{key:'approve',action:'主管批准申请',actor:'主管',occurredAt:'2026-10-01T10:00:00+08:00',changes:[{label:'状态',before:'待审批',after:'已批准'},{label:'意见',before:null,after:'同意'}]}]:[])]}/>}
      actions={<Button label={complete?'重置审批示例':'模拟批准'} onClick={()=>setComplete(value=>!value)}/>}/>
  </DetailPage>;
}
