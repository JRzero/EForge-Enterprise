import {useState} from 'react';
import type Modeler from 'bpmn-js/lib/Modeler';
import type Modeling from 'bpmn-js/lib/features/modeling/Modeling';
import type {Element} from 'bpmn-js/lib/model/Types';
import {Button,Input} from '../../ui/controls';
import {Select,NativeInput} from '../../ui/native';

export function WorkflowNodeProperties({modeler,element,onError,onPending}:{modeler:Modeler;element:Element;onError:(error:string)=>void;onPending:(pending:boolean)=>void}){
  const bo=element.businessObject;
  const [id,setId]=useState(element.id),[name,setName]=useState<string>(bo.name??''),[binding,setBinding]=useState(bo.get('flowable:assignee')?'assignee':bo.get('flowable:candidateUsers')?'candidateUsers':'candidateGroups');
  const [candidate,setCandidate]=useState<string>(bo.get('flowable:assignee')??bo.get('flowable:candidateUsers')??bo.get('flowable:candidateGroups')??''),[async,setAsync]=useState(bo.get('flowable:async')==='true');
  const [condition,setCondition]=useState<string>(bo.conditionExpression?.body?.includes('false')?'false':bo.conditionExpression?'true':'');
  const task=element.type==='bpmn:UserTask',flow=element.type==='bpmn:SequenceFlow';
  function apply(){
    if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id)){onError('标识以字母开头，仅使用字母、数字和下划线，最多 64 字符。');return;}
    if(task&&!(binding==='candidateGroups'?/^role:[1-9][0-9]{0,18}(,role:[1-9][0-9]{0,18}){0,49}$/:binding==='assignee'?/^(?:[1-9][0-9]{0,18}|\$\{approver\})$/:/^[1-9][0-9]{0,18}(,[1-9][0-9]{0,18}){0,49}$/).test(candidate)){onError('请填写有效的账号编号或 role:角色编号，多个候选以英文逗号分隔。');return;}
    const properties:Record<string,unknown>={id,name};
    if(task){for(const key of ['assignee','candidateUsers','candidateGroups'])properties[`flowable:${key}`]=key===binding?candidate:undefined;properties['flowable:async']=async?'true':undefined;}
    if(flow){const factory=modeler.get<{create:(type:string,props:Record<string,string>)=>unknown}>('moddle');properties.conditionExpression=condition?factory.create('bpmn:FormalExpression',{body:`\${approved == ${condition}}`}):undefined;}
    try{onPending(false);modeler.get<Modeling>('modeling').updateProperties(element,properties);onError('');}catch{onPending(true);onError('无法应用属性，请检查标识是否重复。');}
  }
  return <div className="workflow-node-form" onChange={()=>onPending(true)}>
    <Input label="节点标识" value={id} onChange={setId}/><Input label="节点名称" value={name} onChange={setName}/>
    {task?<><label>审批方式<Select value={binding} onChange={event=>{setBinding(event.target.value);setCandidate('');}}><option value="candidateGroups">候选角色</option><option value="candidateUsers">候选人员</option><option value="assignee">指定人员</option></Select></label><Input label="审批对象" value={candidate} onChange={setCandidate}/><small>角色示例 role:2；人员填写账号编号。后端仍会校验当前资格。</small><label className="workflow-inline-check"><NativeInput type="checkbox" checked={async} onChange={event=>setAsync(event.target.checked)}/>后台创建首个人工任务</label></>:null}
    {flow?<label>分支条件<Select value={condition} onChange={event=>setCondition(event.target.value)}><option value="">无条件</option><option value="true">批准</option><option value="false">拒绝</option></Select></label>:null}
    <Button label="应用属性" variant="primary" onClick={apply}/>
  </div>;
}

