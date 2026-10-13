import {useState} from 'react';
import {ApprovalDetailLayout} from '../features/workflow/ApprovalDetailLayout';
import {Button,DetailPage,DetailSection,DetailField} from '../ui';

export function ApprovalDemo(){
  const [complete,setComplete]=useState(false);
  return <DetailPage title="请假审批示例" description="仅演示审批详情布局，处理结果保存在当前页面。">
    <ApprovalDetailLayout summary={<DetailSection title="申请信息"><DetailField label="申请人">林小禾</DetailField><DetailField label="状态">{complete?'已批准':'待审批'}</DetailField><DetailField label="请假事由">个人事务</DetailField></DetailSection>}
      tasks={<DetailSection title="当前任务"><DetailField label="部门审批">{complete?'流程已结束':'等待主管处理'}</DetailField></DetailSection>}
      history={<section aria-label="示例审批记录"><h2>处理记录</h2><ol><li>林小禾提交申请</li>{complete?<li>主管批准申请</li>:null}</ol></section>}
      actions={<Button label={complete?'重置审批示例':'模拟批准'} onClick={()=>setComplete(value=>!value)}/>}/>
  </DetailPage>;
}
