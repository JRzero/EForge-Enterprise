import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NoticeRichContent, RichTextEditor} from '../../features/notices/RichTextEditor';

function Fixture() {
  const [value, setValue] = useState('<p>初始内容</p>'), [disabled, setDisabled] = useState(false), [mounted, setMounted] = useState(true), [busy, setBusy] = useState(false);
  return <><button onClick={() => setValue('<h2>回填标题</h2><p>回填内容</p>')}>回填</button><button onClick={() => setDisabled(!disabled)}>切换只读</button><button onClick={() => setMounted(!mounted)}>切换编辑器</button>
    {mounted && <RichTextEditor value={value} onChange={setValue} disabled={disabled} onBusyChange={setBusy} uploadImage={async (file, signal) => {
      await new Promise<void>((resolve, reject) => {const timer = setTimeout(resolve, 200); signal.addEventListener('abort', () => {clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError'));}, {once: true});});
      return new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('读取失败')); reader.readAsDataURL(file);});
    }} />}
    <output aria-label="上传状态">{busy ? '正在上传' : '空闲'}</output><output aria-label="保存内容">{value}</output><section aria-label="内容预览"><NoticeRichContent html={value} /></section></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
