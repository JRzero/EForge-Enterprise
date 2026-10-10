export const BPMN='http://www.omg.org/spec/BPMN/20100524/MODEL';
const DI='http://www.omg.org/spec/BPMN/20100524/DI',DC='http://www.omg.org/spec/DD/20100524/DC',DD='http://www.omg.org/spec/DD/20100524/DI';
const kinds=new Set(['definitions','process','startEvent','endEvent','userTask','exclusiveGateway','sequenceFlow','conditionExpression','documentation','incoming','outgoing']);
export const nodeTypes=['bpmn:StartEvent','bpmn:UserTask','bpmn:ExclusiveGateway','bpmn:EndEvent'] as const;
export const nodeNames=['开始','人工审批','审批分支','结束'];
export const flowableDescriptor={name:'Flowable',uri:'http://flowable.org/bpmn',prefix:'flowable',xml:{tagAlias:'lowerCase'},types:[{
  name:'HumanTask',extends:['bpmn:UserTask'],properties:['assignee','candidateUsers','candidateGroups','async'].map(name=>({name,isAttr:true,type:'String'}))
}]};

/** Old packages lack DI. Add only inert layout, retaining the exact semantic DOM. */
export function prepareDiagram(xml:string):string{
  if(xml.length>262144||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('流程文件过大或包含不支持的声明。');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='definitions')throw new Error('流程 XML 格式无效，请先修正源码。');
  const allowed:Record<string,Set<string>>={[BPMN]:kinds,[DI]:new Set(['BPMNDiagram','BPMNPlane','BPMNShape','BPMNEdge','BPMNLabel']),[DC]:new Set(['Bounds']),[DD]:new Set(['waypoint'])};
  const ids=new Set<string>();
  for(const element of doc.querySelectorAll('*')){
    if(!allowed[element.namespaceURI??'']?.has(element.localName))throw new Error('流程包含当前设计器不支持的节点或扩展，请保留源码处理。');
    const id=element.getAttribute('id');if(id){if(ids.has(id))throw new Error('流程标识重复。');ids.add(id);}
  }
  const processes=doc.getElementsByTagNameNS(BPMN,'process');
  if(processes.length!==1)throw new Error('设计器只支持一个审批流程。');
  if(doc.getElementsByTagNameNS(DI,'BPMNDiagram').length)return xml;
  const process=processes[0]!,nodes=[...process.children].filter(e=>['startEvent','userTask','exclusiveGateway','endEvent'].includes(e.localName));
  if(!nodes.length||nodes.length>100)throw new Error('流程节点数量无效。');
  const flows=[...process.children].filter(e=>e.localName==='sequenceFlow');
  function make(ns:string,tag:string,attributes:Record<string,string|number>){const e=doc.createElementNS(ns,tag);for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));return e;}
  function unique(base:string){let id=base,n=1;while(ids.has(id))id=`${base}_${n++}`;ids.add(id);return id;}
  const diagram=make(DI,'bpmndi:BPMNDiagram',{id:unique('Diagram_1')}),plane=make(DI,'bpmndi:BPMNPlane',{id:unique('Plane_1'),bpmnElement:process.id});diagram.append(plane);
  const positions=new Map<string,{x:number;y:number;width:number;height:number}>();
  // Breadth-first ranks keep approval/rejection outcomes together, independently of XML order.
  const ranks=new Map<string,number>(),queue=nodes.filter(n=>n.localName==='startEvent').map(n=>n.id);
  queue.forEach(id=>ranks.set(id,0));
  for(let i=0;i<queue.length;i++)for(const flow of flows.filter(f=>f.getAttribute('sourceRef')===queue[i])){
    const target=flow.getAttribute('targetRef')??'';
    if(!ranks.has(target)){ranks.set(target,(ranks.get(queue[i]!)??0)+1);queue.push(target);}
  }
  const rows=new Map<number,number>();
  nodes.forEach((node,i)=>{
    const width=node.localName==='userTask'?120:40,height=node.localName==='userTask'?80:40;
    const rank=ranks.get(node.id)??0,row=rows.get(rank)??0;rows.set(rank,row+1);
    const bounds={x:80+rank*180,y:100+row*140-height/2,width,height};positions.set(node.id,bounds);
    const shape=make(DI,'bpmndi:BPMNShape',{id:unique(`Shape_${i}`),bpmnElement:node.id});shape.append(make(DC,'dc:Bounds',bounds));plane.append(shape);
  });
  flows.forEach((flow,i)=>{
    const from=positions.get(flow.getAttribute('sourceRef')??''),to=positions.get(flow.getAttribute('targetRef')??'');
    if(!from||!to)throw new Error('流程连线引用了不存在的节点。');
    const edge=make(DI,'bpmndi:BPMNEdge',{id:unique(`Edge_${i}`),bpmnElement:flow.id});
    const x=from.x+from.width,y=from.y+from.height/2,ty=to.y+to.height/2;
    edge.append(make(DD,'di:waypoint',{x,y}));
    if(y!==ty){const bend=(x+to.x)/2;edge.append(make(DD,'di:waypoint',{x:bend,y}),make(DD,'di:waypoint',{x:bend,y:ty}));}
    edge.append(make(DD,'di:waypoint',{x:to.x,y:ty}));plane.append(edge);
  });
  doc.documentElement.append(diagram);return new XMLSerializer().serializeToString(doc);
}
