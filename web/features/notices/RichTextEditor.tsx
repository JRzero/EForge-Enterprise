import {useEffect, useRef, useState} from 'react';
import Quill from 'quill';
import Video from 'quill/formats/video';
import 'quill/dist/quill.snow.css';
import {sanitizeNoticeHtml} from './rich-text';

const toolbar = [
  ['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'],
  [{list: 'ordered'}, {list: 'bullet'}], [{indent: '-1'}, {indent: '+1'}],
  [{size: ['small', false, 'large', 'huge']}], [{header: [1, 2, 3, 4, 5, 6, false]}],
  [{color: []}, {background: []}], [{align: []}], ['clean'], ['link', 'image', 'video'],
];
const labels: Record<string, string> = {bold: '粗体', italic: '斜体', underline: '下划线', strike: '删除线', blockquote: '引用', 'code-block': '代码块', list: '列表', indent: '缩进', size: '字号', header: '标题', color: '文字颜色', background: '背景颜色', align: '对齐', clean: '清除格式', link: '链接', image: '图片', video: '视频'};

class NoticeVideo extends Video {
  static create(value: string): Element {
    const node = super.create(value);
    const holder = document.createElement('div'); holder.innerHTML = sanitizeNoticeHtml(node.outerHTML);
    return holder.firstElementChild!;
  }
  html(): string {return sanitizeNoticeHtml(this.domNode.outerHTML);}
}
// Quill's default export converts video into a link and its editing frame is
// unsandboxed. Keep the original video capability inside the same HTML boundary.
Quill.register('formats/video', NoticeVideo, true);

type Props = {
  value: string;
  onChange: (html: string) => void;
  uploadImage: (file: File, signal: AbortSignal) => Promise<string>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

function insertUploadedImage(quill: Quill, index: number, source: string) {
  quill.insertEmbed(Math.min(index, quill.getLength() - 1), 'image', source, 'user');
  const range = {index: Math.min(index + 1, quill.getLength() - 1), length: 0}; quill.setSelection(range.index, range.length, 'silent'); return range;
}
export function RichTextEditor(props: Props) {
  const container = useRef<HTMLDivElement>(null), editor = useRef<Quill | null>(null);
  const latest = useRef(props), emitted = useRef(''), received = useRef('');
  const selection = useRef<{index: number; length: number} | null>(null);
  const pending = useRef<AbortController | null>(null), completedImages = useRef<{index: number; source: string}[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {latest.current = props;});
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const surface = document.createElement('div'); host.append(surface);
    const controller = new AbortController();
    const quill = new Quill(surface, {theme: 'snow', placeholder: '请输入内容', modules: {toolbar}, readOnly: latest.current.disabled});
    editor.current = quill;
    quill.root.setAttribute('aria-label', '公告内容'); quill.root.setAttribute('role', 'textbox');
    quill.root.setAttribute('aria-multiline', 'true'); quill.root.style.minHeight = '192px';
    host.querySelectorAll('button,select,.ql-picker-label').forEach(control => {
      const format = [...control.classList, ...(control.parentElement?.classList ?? [])].find(value => value.startsWith('ql-') && labels[value.slice(3)]);
      if (format) {const label = labels[format.slice(3)]!; control.setAttribute('aria-label', label); control.setAttribute('title', label);}
    });
    async function insertImage(file: File) {
      if (pending.current || latest.current.disabled || controller.signal.aborted) return;
      if (!['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.type) || file.size >= 5 * 1024 * 1024) {setError('请选择小于 5 MB 的 JPG、PNG 或 SVG 图片。'); return;}
      const index = quill.getSelection(true)?.index ?? quill.getLength() - 1;
      const uploadController = new AbortController(); pending.current = uploadController;
      const busyChanged = latest.current.onBusyChange; busyChanged?.(true); setError('');
      try {
        const url = await latest.current.uploadImage(file, uploadController.signal);
        if (uploadController.signal.aborted) return;
        const safe = document.createElement('div'); safe.innerHTML = sanitizeNoticeHtml(`<img src="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`);
        const source = safe.querySelector('img')?.getAttribute('src');
        if (!source) throw new Error('图片地址不可用。');
        if (editor.current && !latest.current.disabled) selection.current = insertUploadedImage(editor.current, index, source);
        else completedImages.current.push({index, source});
      } catch (cause) {if (!uploadController.signal.aborted) setError(cause instanceof Error ? cause.message : '图片上传失败，请重试。');}
      finally {if (pending.current === uploadController) pending.current = null; busyChanged?.(false);}
    }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/svg+xml'; input.hidden = true; host.append(input);
    input.addEventListener('change', () => {const file = input.files?.[0]; if (file) void insertImage(file); input.value = '';});
    const toolbarModule = quill.getModule('toolbar') as {addHandler: (name: string, handler: () => void) => void};
    toolbarModule.addHandler('image', () => {if (!latest.current.disabled && !pending.current) input.click();});
    function paste(event: ClipboardEvent) {
      if (latest.current.disabled) return;
      const file = [...(event.clipboardData?.items ?? [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
      const html = event.clipboardData?.getData('text/html');
      if (!file && !html) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (file) {void insertImage(file); return;}
      const range = quill.getSelection(true) ?? {index: quill.getLength() - 1, length: 0};
      if (range.length) quill.deleteText(range.index, range.length, 'user');
      quill.clipboard.dangerouslyPasteHTML(range.index, sanitizeNoticeHtml(html!), 'user');
    }
    quill.root.addEventListener('paste', paste, true);
    function change() {const clean = quill.getLength() === 1 ? '' : sanitizeNoticeHtml(quill.getSemanticHTML()); emitted.current = clean; latest.current.onChange(clean);}
    quill.on('text-change', change);
    function selected(range: {index: number; length: number} | null) {if (range) selection.current = {index: range.index, length: range.length};}
    quill.on('selection-change', selected);
    const incoming = sanitizeNoticeHtml(latest.current.value); if (incoming !== received.current) {received.current = incoming; emitted.current = incoming;}
    quill.clipboard.dangerouslyPasteHTML(emitted.current, 'silent');
    if (selection.current) quill.setSelection(Math.min(selection.current.index, quill.getLength() - 1), selection.current.length, 'silent');
    return () => {controller.abort(); quill.off('text-change', change); quill.off('selection-change', selected); quill.root.removeEventListener('paste', paste, true); editor.current = null; host.replaceChildren();};
  }, []);
  useEffect(() => {
    const quill = editor.current; if (!quill) return;
    quill.enable(!props.disabled);
    const clean = sanitizeNoticeHtml(props.value);
    if (clean !== received.current) {received.current = clean; if (clean !== emitted.current) {emitted.current = clean; quill.clipboard.dangerouslyPasteHTML(clean, 'silent');}}
    if (!props.disabled) for (const image of completedImages.current.splice(0)) selection.current = insertUploadedImage(quill, image.index, image.source);
  }, [props.value, props.disabled]);
  return <div className="rich-text-editor"><div ref={container} />{error && <p role="alert">{error}</p>}</div>;
}
