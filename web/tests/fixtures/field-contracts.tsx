import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider, FormField, MultiSelect, TreeSelect, ReferenceSelect, ResourceDialog, NativeButton, NativeInput} from '../../ui';
import '../../ui/theme.css';

type Mode = 'editable' | 'readonly' | 'disabled' | 'loading' | 'failed';
type Kind = 'multi' | 'tree' | 'reference';
const oldId = '9007199254740993', nextId = '9007199254740995';
const labels = {multi: '参与人员', tree: '负责部门', reference: '关联客户'};

function Fields() {
  const [mode, setMode] = useState<Mode>('editable'), [issues, setIssues] = useState(true);
  const [people, setPeople] = useState([oldId]), [department, setDepartment] = useState<string | null>(oldId), [customer, setCustomer] = useState<string | null>(oldId);
  const [code, setCode] = useState('A001'), [dialog, setDialog] = useState<Kind | null>(null), [saved, setSaved] = useState(0);
  // Real keyboard events change props without first moving focus outside the popup.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const modes: Record<string, Mode> = {F6:'readonly', F7:'disabled', F8:'editable', F9:'loading', F10:'failed'};
      const next = modes[event.key];
      if (next) {event.preventDefault();setMode(next);}
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  const disabled = mode === 'disabled', readOnly = mode === 'readonly', loading = mode === 'loading';
  const error = mode === 'failed' ? '选项加载失败' : undefined;
  const retry = () => setMode('editable');
  function selection(kind: Kind, prefix: string) {
    const label = labels[kind];
    if (kind === 'multi') return <MultiSelect id={`${prefix}-multi`} label={label} required hint="请选择当前业务的参与人员" fieldError={issues ? '请核对参与人员' : undefined}
      value={people} onChange={setPeople} options={[{value:nextId,label:'新人员'},{value:'disabled',label:'停用人员',disabled:true}]}
      unknownLabel={value=>`原人员（${value}）`} disabled={disabled} readOnly={readOnly} loading={loading} error={error} onRetry={retry}/>;
    if (kind === 'tree') return <TreeSelect id={`${prefix}-tree`} label={label} required hint="请选择当前业务的负责部门" fieldError={issues ? '请核对负责部门' : undefined}
      value={department} onChange={setDepartment} nodes={[{value:'root',label:'总部'},{value:nextId,parentValue:'root',label:'新部门'},{value:'disabled',parentValue:'root',label:'停用部门',disabled:true}]}
      unknownLabel="原部门" disabled={disabled} readOnly={readOnly} loading={loading} error={error} onRetry={retry}/>;
    return <ReferenceSelect id={`${prefix}-reference`} label={label} required hint="请选择当前业务的关联客户" fieldError={issues ? '请核对关联客户' : undefined}
      value={customer} onChange={setCustomer} options={[{value:nextId,label:'新客户'},{value:'disabled',label:'停用客户',disabled:true}]} selectedLabel="原客户"
      disabled={disabled} readOnly={readOnly} loading={loading} error={error} onRetry={retry}/>;
  }
  return <EForgeProvider><main style={{maxWidth:760, margin:'0 auto', padding:16}}>
    <h1>字段契约验收</h1>
    <p>F6 只读，F7 禁用，F8 恢复，F9 加载，F10 失败。</p>
    <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16}}>
      <NativeButton type="button" onClick={()=>setIssues(value=>!value)}>切换字段错误</NativeButton>
      <NativeButton type="button" onClick={()=>setMode('editable')}>恢复编辑</NativeButton>
      <NativeButton type="button" onClick={()=>setMode('readonly')}>切换只读</NativeButton>
      <NativeButton type="button" onClick={()=>setMode('failed')}>选项失败</NativeButton>
    </div>
    <form onSubmit={event=>{event.preventDefault();setSaved(value=>value+1);}}>
      <section aria-label="原生字段" style={{display:'grid', gap:12, marginBottom:24}}>
        <FormField id="contract-code" label="业务编码" required hint="编码用于识别业务" error={issues ? '业务编码已存在' : undefined}>
          {control=><NativeInput {...control} value={code} onChange={event=>setCode(event.target.value)}/>}
        </FormField>
        <FormField id="contract-note" label="补充说明" hint="说明保留在当前草稿">
          {control=><div {...control} role="textbox" contentEditable suppressContentEditableWarning tabIndex={0}>原说明</div>}
        </FormField>
        <FormField label="自动编号字段甲">{control=><NativeInput {...control}/>}</FormField>
        <FormField label="自动编号字段乙">{control=><NativeInput {...control}/>}</FormField>
      </section>
      {(['multi','tree','reference'] as const).map(kind=><section aria-label={`${labels[kind]}测试`} key={kind} style={{marginBottom:24}}>{selection(kind,'contract')}</section>)}
      <ReferenceSelect label="自动关联客户" value={customer} onChange={setCustomer} options={[{value:nextId,label:'新客户'}]} selectedLabel="原客户"
        disabled={disabled} readOnly={readOnly} loading={loading} error={error} onRetry={retry}/>
      <NativeButton type="submit">保存当前值</NativeButton>
    </form>
    <p><output aria-label="已保存次数">{saved}</output></p>
    <p style={{overflowWrap:'anywhere'}}><output aria-label="当前选择">{JSON.stringify({people,department,customer})}</output></p>
    <div style={{display:'flex', flexWrap:'wrap', gap:8}}>{(['multi','tree','reference'] as const).map(kind=><NativeButton type="button" key={kind} onClick={()=>setDialog(kind)}>打开{labels[kind]}弹窗</NativeButton>)}</div>
    {dialog && <ResourceDialog titleId="field-dialog-title" busy={false} onCancel={()=>setDialog(null)}>
      <h2 id="field-dialog-title">{labels[dialog]}设置</h2>
      <NativeButton type="button" onClick={()=>{setSaved(value=>value+1);setDialog(null);}}>保存并关闭</NativeButton>
      <form onSubmit={event=>{event.preventDefault();setSaved(value=>value+1);setDialog(null);}}>
        {selection(dialog,'dialog')}
        <div className="post-dialog-actions"><NativeButton type="submit">保存弹窗</NativeButton><NativeButton type="button" onClick={()=>setDialog(null)}>取消弹窗</NativeButton></div>
      </form>
    </ResourceDialog>}
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fields/></StrictMode>);
