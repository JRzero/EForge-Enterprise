import {StrictMode, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RichTextEditor, type RichTextEditorHandle} from '../../ui/RichTextEditor';
import {EForgeProvider} from '../../ui/controls';
import '../../ui/theme.css';

function Fixture() {
  const [value, setValue] = useState('<p>原始内容</p>'), [other, setOther] = useState('');
  const [mode, setMode] = useState('editable'), [issue, setIssue] = useState(true), [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0), [changes, setChanges] = useState(0);
  const editor = useRef<RichTextEditorHandle>(null), release = useRef<() => void>(undefined);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!['F6', 'F7', 'F8'].includes(event.key)) return;
      event.preventDefault(); setMode(event.key === 'F6' ? 'readonly' : event.key === 'F7' ? 'disabled' : 'editable');
    }
    document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut);
  }, []);
  return <EForgeProvider><main style={{maxWidth:800, margin:'0 auto', padding:16}}>
    <h1>富文本字段验收</h1>
    <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16}}>
      <button type="button" onClick={()=>editor.current?.focus()}>聚焦正文</button>
      <button type="button" onClick={()=>setIssue(value=>!value)}>切换校验</button>
      <button type="button" onClick={()=>release.current?.()}>完成上传</button>
    </div>
    <RichTextEditor ref={editor} id="contract-content" label="业务正文" required hint="支持格式与图片，请填写完整内容。" fieldError={issue?'正文需要核对':undefined}
      value={value} onChange={html=>{setValue(html);setChanges(count=>count+1);}} readOnly={mode==='readonly'} disabled={mode==='disabled'} onBusyChange={setBusy}
      uploadImage={async()=>{setUploads(count=>count+1);await new Promise<void>(resolve=>{release.current=resolve;});return '/eforge-mark.svg';}}/>
    <button type="button">后续操作</button>
    <output aria-label="正文值">{value}</output><output aria-label="变更次数">{changes}</output><output aria-label="上传次数">{uploads}</output><output aria-label="上传状态">{busy?'上传中':'空闲'}</output>
    <RichTextEditor label="补充正文" value={other} onChange={setOther} uploadImage={async()=>'/eforge-mark.svg'}/>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>);
