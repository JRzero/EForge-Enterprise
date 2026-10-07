import {Activity, StrictMode, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RichTextEditor} from '../../features/notices/RichTextEditor';
import {NoticeRichContent} from '../../features/notices/NoticeRichContent';

function Fixture() {
  const [value, setValue] = useState('<p>初始内容</p>'), [disabled, setDisabled] = useState(false), [mounted, setMounted] = useState(true), [pending, setPending] = useState(0), [visible, setVisible] = useState(true), [held, setHeld] = useState(false), [started, setStarted] = useState(0), [completed, setCompleted] = useState(0), [aborted, setAborted] = useState(0);
  const gates = useRef<(() => void)[]>([]); const busy = pending > 0;
  return <><button onClick={() => setValue('<h2>回填标题</h2><p>回填内容</p>')}>回填</button><button onClick={() => setDisabled(!disabled)}>切换只读</button><button onClick={() => setMounted(!mounted)}>切换编辑器</button>
    <button onClick={() => setVisible(!visible)}>切换可见</button><button onClick={() => setHeld(!held)}>阻塞上传</button><button onClick={() => gates.current.shift()?.()}>释放一次上传</button>
    <Activity mode={visible ? 'visible' : 'hidden'}>{mounted && <RichTextEditor value={value} onChange={setValue} disabled={disabled} onBusyChange={active => setPending(count => Math.max(0, count + (active ? 1 : -1)))} uploadImage={async (file, signal) => {
      setStarted(count => count + 1);
      await new Promise<void>((resolve, reject) => {let timer: ReturnType<typeof setTimeout> | undefined;
        if (held) gates.current.push(resolve); else timer = setTimeout(resolve, 200);
        signal.addEventListener('abort', () => {clearTimeout(timer); setAborted(count => count + 1); reject(new DOMException('Cancelled', 'AbortError'));}, {once: true});});
      setCompleted(count => count + 1);
      return new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('读取失败')); reader.readAsDataURL(file);});
    }} />}</Activity>
    <output aria-label="开始上传">{started}</output><output aria-label="完成上传">{completed}</output><output aria-label="取消上传">{aborted}</output><output aria-label="上传状态">{busy ? '正在上传' : '空闲'}</output><output aria-label="保存内容">{value}</output><section aria-label="内容预览"><NoticeRichContent html={value} /></section></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
