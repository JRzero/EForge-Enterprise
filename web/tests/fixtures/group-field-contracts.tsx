import {StrictMode,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CheckboxGroup,RadioGroup,type ChoiceGroupHandle} from '../../ui/ChoiceGroup';
import {DateRangeField,type DateRangeFieldHandle} from '../../ui/DateRangeField';
import {EForgeProvider} from '../../ui/controls';
import '../../ui/theme.css';

function Fixture(){
  const [checks,setChecks]=useState(['9007199254740993']),[radio,setRadio]=useState<string|null>('9007199254740993'),[other,setOther]=useState<string|null>('new');
  const [dates,setDates]=useState({from:'2026-10-01',to:'2026-10-02'}),[issue,setIssue]=useState(true),[mode,setMode]=useState('editable'),[saved,setSaved]=useState(0);
  const checksRef=useRef<ChoiceGroupHandle>(null),radioRef=useRef<ChoiceGroupHandle>(null),dateRef=useRef<DateRangeFieldHandle>(null),emptyRef=useRef<ChoiceGroupHandle>(null);
  const disabled=mode==='disabled',readOnly=mode==='readonly';
  const options=[{value:'new',label:'可用项'},{value:'disabled',label:'停用项',disabled:true}];
  return <EForgeProvider><main style={{maxWidth:720,margin:'0 auto',padding:16}}>
    <h1>分组字段契约</h1>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['editable','readonly','disabled'].map(value=><button type="button" key={value} onClick={()=>setMode(value)}>{{editable:'编辑',readonly:'只读',disabled:'禁用'}[value]}</button>)}<button type="button" onClick={()=>setIssue(value=>!value)}>切换错误</button></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>checksRef.current?.focus()}>定位多选</button><button type="button" onClick={()=>radioRef.current?.focus()}>定位单选</button><button type="button" onClick={()=>dateRef.current?.focus('to')}>定位结束日期</button><button type="button" onClick={()=>emptyRef.current?.focus()}>定位空组</button></div>
    <form onSubmit={event=>{event.preventDefault();setSaved(value=>value+1);}} style={{display:'grid',gap:20,marginBlock:20}}>
      <CheckboxGroup ref={checksRef} id="contract-checks" label="通知渠道" required hint="至少保留一个通知渠道" fieldError={issue?'请核对通知渠道':undefined}
        value={checks} options={options} onChange={setChecks} unknownLabel={id=>`原渠道 ${id}`} disabled={disabled} readOnly={readOnly}/>
      <RadioGroup ref={radioRef} id="contract-radio" label="服务等级" required hint="请选择服务等级" fieldError={issue?'请核对服务等级':undefined}
        value={radio} options={options} onChange={setRadio} unknownLabel={id=>`原等级 ${id}`} disabled={disabled} readOnly={readOnly}/>
      <RadioGroup label="第二服务等级" value={other} options={[...options,{value:'second',label:'另一等级'}]} onChange={setOther}/>
      <CheckboxGroup ref={emptyRef} label="空的渠道" value={[]} options={[]} onChange={()=>{}} disabled={disabled} readOnly={readOnly}/>
      <DateRangeField ref={dateRef} id="contract-period" label="服务周期" value={dates} onChange={setDates} required hint="按日期保存，不转换时区"
        error={issue?'请核对日期':undefined} fieldError={issue?'请核对日期':undefined} disabled={disabled} readOnly={readOnly}/>
      <button type="submit">保存草稿</button>
    </form>
    <output aria-label="当前草稿" style={{overflowWrap:'anywhere'}}>{JSON.stringify({checks,radio,other,dates})}</output><output aria-label="保存次数">{saved}</output>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>);
