import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import type Modeling from 'bpmn-js/lib/features/modeling/Modeling';
import type ElementFactory from 'bpmn-js/lib/features/modeling/ElementFactory';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type {Element,Parent} from 'bpmn-js/lib/model/Types';
import {Button} from '../../ui/controls';
import {Select} from '../../ui/native';
import {WorkflowNodeProperties} from './WorkflowNodeProperties';
import {flowableDescriptor,nodeTypes,nodeNames,prepareDiagram} from './designer-xml';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

export interface DesignerHandle {save:()=>Promise<string>}
export function WorkflowDesigner({initialXml,onDirty,onReady,disabled,ref}:{initialXml:string;onDirty:()=>void;onReady:(ready:boolean)=>void;disabled:boolean;ref:Ref<DesignerHandle>}){
  const [source]=useState(initialXml),container=useRef<HTMLDivElement>(null),instance=useRef<Modeler|null>(null);
  const pending=useRef(false),selectedElement=useRef<Element|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<Element|null>(null),[elements,setElements]=useState<Element[]>([]),[revision,setRevision]=useState(0),[target,setTarget]=useState('');
  useImperativeHandle(ref,()=>({save:async()=>{
    if(!ready||!instance.current)throw new Error('画布尚未准备好，请修正源码后重试。');
    if(pending.current)throw new Error('请先点击“应用属性”，再保存或切换源码。');
    const {xml}=await instance.current.saveXML({format:true});if(!xml)throw new Error('流程序列化失败。');return xml;
  }}),[ready]);
  useEffect(()=>{
    if(!container.current)return;let alive=true,imported=false;
    const modeler=new Modeler({container:container.current,moddleExtensions:{flowable:flowableDescriptor},
      additionalModules:[{paletteProvider:['value',{}],contextPadProvider:['value',{}],keyboardBindings:['value',{}]}]});
    instance.current=modeler;
    function refresh(){
      if(!alive)return;
      setElements((modeler.get<ElementRegistry>('elementRegistry').getAll() as Element[]).filter(e=>typeof e.type==='string'&&[...nodeTypes,'bpmn:SequenceFlow'].includes(e.type)));
      if(pending.current)return;
      selectedElement.current=(modeler.get<Selection>('selection').get()[0] as Element|undefined)??null;
      setSelected(selectedElement.current);setRevision(v=>v+1);
    }
    modeler.on('selection.changed',()=>{
      const selection=modeler.get<Selection>('selection');
      if(pending.current&&selection.get()[0]!==selectedElement.current){selection.select(selectedElement.current??[]);setError('请先应用当前节点属性，再选择其他节点。');return;}
      const clicked=selection.get()[0] as Element|undefined;
      if(clicked?.labelTarget){selection.select(clicked.labelTarget as Element);return;}
      refresh();
    });
    modeler.on('commandStack.changed',()=>{if(alive&&imported){refresh();onDirty();}});
    void (async()=>{
      try{const result=await modeler.importXML(prepareDiagram(source));if(!alive)return;if(result.warnings.length)throw new Error('流程包含无法完整导入的内容，请使用源码修正后重试。');
        imported=true;modeler.get<Canvas>('canvas').zoom('fit-viewport');refresh();setReady(true);onReady(true);
      }catch(cause){if(alive){setError(cause instanceof Error?cause.message:'画布加载失败。');onReady(false);}}
    })();
    const observer=new ResizeObserver(entries=>{if(alive&&imported&&entries.some(entry=>entry.contentRect.width>0&&entry.contentRect.height>0)){
      modeler.get<Canvas>('canvas').resized();modeler.get<Canvas>('canvas').zoom('fit-viewport');
    }});
    observer.observe(container.current);
    return()=>{alive=false;observer.disconnect();instance.current=null;modeler.destroy();};
  },[source,onDirty,onReady]);
  function act(work:(m:Modeler)=>void){if(!ready||disabled||!instance.current)return;if(pending.current){setError('请先应用当前节点属性，再操作画布。');return;}try{work(instance.current);setError('');}catch{setError('此操作不适用于当前节点，请检查选择和连线。');}}
  function add(type:string){act(m=>{const canvas=m.get<Canvas>('canvas'),box=canvas.viewbox();
    const shape=m.get<ElementFactory>('elementFactory').createShape({type});
    const created=m.get<Modeling>('modeling').createShape(shape,{x:box.x+box.width/2,y:box.y+box.height/2},canvas.getRootElement() as Parent);
    if(type==='bpmn:UserTask')m.get<Modeling>('modeling').updateProperties(created,{'flowable:candidateGroups':'role:2',name:'人工审批'});
    m.get<Selection>('selection').select(created);
  });}
  const stack=instance.current?.get<CommandStack>('commandStack');
  return <section className="workflow-designer" aria-label="可视化流程设计器" aria-busy={!ready&&!error}>
    <div className="workflow-designer-toolbar">
      <span className="workflow-toolbar-title">画布视图</span>
      <Button label="撤销" variant="ghost" isDisabled={disabled||!ready||!stack?.canUndo()} onClick={()=>act(m=>m.get<CommandStack>('commandStack').undo())}/>
      <Button label="重做" variant="ghost" isDisabled={disabled||!ready||!stack?.canRedo()} onClick={()=>act(m=>m.get<CommandStack>('commandStack').redo())}/>
      <Button label="适配画布" variant="ghost" isDisabled={!ready} onClick={()=>act(m=>m.get<Canvas>('canvas').zoom('fit-viewport'))}/>
      {[-1,1].map(direction=><Button key={direction} label={direction>0?'放大':'缩小'} variant="ghost" isDisabled={!ready||disabled} onClick={()=>act(m=>{const canvas=m.get<Canvas>('canvas');canvas.zoom(Math.max(.2,Math.min(3,canvas.zoom()+direction*.2)));})}/>)}
    </div>
    {!ready&&!error?<p role="status">正在加载流程画布…</p>:null}{error?<p role="alert">{error}</p>:null}
    <div className="workflow-designer-layout" inert={disabled||!ready}>
      <aside className="workflow-node-palette" aria-label="流程节点工具">
        <h3>添加节点</h3><p>点击添加，再拖动排列</p>
        {nodeTypes.map((type,i)=><Button key={type} label={`添加${nodeNames[i]}`} variant="secondary" isDisabled={!ready||disabled} onClick={()=>add(type)}/>)}
        <p>选中节点后，在右侧设置审批对象与下一步。</p>
      </aside>
      <div ref={container} className="workflow-designer-canvas" tabIndex={0} role="region" aria-label="流程画布" onKeyDown={event=>{
        if(event.target!==event.currentTarget)return;
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();act(m=>{const commands=m.get<CommandStack>('commandStack');if(event.shiftKey)commands.redo();else commands.undo();});}
      }}/>
      <aside className="workflow-designer-properties" aria-label="节点属性">
        <h3>{selected?'配置所选节点':'节点设置'}</h3>
        <label>选择节点或连线<Select value={selected?.id??''} onChange={event=>act(m=>{const element=m.get<ElementRegistry>('elementRegistry').get(event.target.value);m.get<Selection>('selection').select(element??[]);})}><option value="">请选择</option>{elements.map(e=><option key={e.id} value={e.id}>{e.businessObject.name||e.id} · {e.id}</option>)}</Select></label>
        {selected&&instance.current?<WorkflowNodeProperties key={`${selected.id}-${revision}`} modeler={instance.current} element={selected} onError={setError} onPending={value=>{pending.current=value;if(value)onDirty();}}/>:<p>点击画布节点编辑属性，也可使用上方选择框。</p>}
        {selected&&nodeTypes.some(t=>t===selected.type)?<><label>连接到<Select value={target} onChange={event=>setTarget(event.target.value)}><option value="">请选择目标</option>{elements.filter(e=>nodeTypes.some(t=>t===e.type)&&e.id!==selected.id).map(e=><option key={e.id} value={e.id}>{e.businessObject.name||e.id} · {e.id}</option>)}</Select></label><Button label="连接节点" variant="secondary" isDisabled={!target} onClick={()=>act(m=>{const to=m.get<ElementRegistry>('elementRegistry').get(target);if(to)m.get<Modeling>('modeling').connect(selected,to as Element);})}/></>:null}
        {selected?<Button label="删除所选" variant="secondary" onClick={()=>act(m=>m.get<Modeling>('modeling').removeElements([selected]))}/>:null}
      </aside>
    </div>
    <p className="workflow-designer-help">拖动节点调整布局；选中连线可调整路径。通过属性栏设置审批人和分支条件。保存草稿后仍需服务端场景校验。</p>
  </section>;
}

