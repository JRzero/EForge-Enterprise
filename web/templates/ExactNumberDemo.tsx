import {useState} from 'react';
import {Button,ExactNumberInput,FormField,PageForm} from '../ui';
export function ExactNumberDemo(){
  const [amount,setAmount]=useState('9007199254740993.0100'),[percent,setPercent]=useState('0'),[saved,setSaved]=useState(''),[readonly,setReadonly]=useState(false);
  return <section aria-label="精确数值示例"><h2>精确金额与百分比</h2><p>使用字符串保存，不自动舍入；百分比按所见数值保存，不转换比例。</p>
    <PageForm onSubmit={event=>{event.preventDefault();setSaved(JSON.stringify({amount,percent}));}}>
      <FormField label="精确金额" hint="可粘贴 9,007,199,254,740,993.0100；保留尾零。">{attributes=><ExactNumberInput {...attributes} value={amount} onValueChange={setAmount} scale={4} min="0" unit="元" readOnly={readonly}/>}</FormField>
      <FormField label="百分比">{attributes=><ExactNumberInput {...attributes} value={percent} onValueChange={setPercent} min="0" max="100" scale={2} unit="%" readOnly={readonly}/>}</FormField>
      <Button label="保存数值示例" type="submit"/><Button label={readonly?'恢复数值编辑':'数值只读'} onClick={()=>setReadonly(value=>!value)}/>
    </PageForm>{saved&&<output aria-label="已保存精确数值">{saved}</output>}
  </section>;
}
