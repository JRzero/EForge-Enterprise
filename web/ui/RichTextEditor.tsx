import {useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref} from 'react';
import Quill from 'quill';
import Video from 'quill/formats/video';
import 'quill/dist/quill.snow.css';
import {sanitizeNoticeHtml} from './rich-text-security';
import './rich-text-editor.css';

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
  id?: string;
  label?: string;
  required?: boolean;
  hint?: string;
  fieldError?: string;
  ref?: Ref<RichTextEditorHandle>;
  value: string;
  onChange: (html: string) => void;
  uploadImage: (file: File, signal: AbortSignal) => Promise<string>;
  disabled?: boolean;
  readOnly?: boolean;
  onBusyChange?: (busy: boolean) => void;
};
export type RichTextEditorHandle = {focus: () => void};

function insertUploadedImage(quill: Quill, index: number, source: string) {
  quill.insertEmbed(Math.min(index, quill.getLength() - 1), 'image', source, 'user');
  const range = {index: Math.min(index + 1, quill.getLength() - 1), length: 0}; quill.setSelection(range.index, range.length, 'silent'); return range;
}
export function RichTextEditor(props: Props) {
  const generatedId = useId(), id = props.id ?? generatedId, label = props.label ?? '公告内容';
  const container = useRef<HTMLDivElement>(null), editor = useRef<Quill | null>(null);
  const latest = useRef(props), emitted = useRef(''), received = useRef('');
  const selection = useRef<{index: number; length: number} | null>(null);
  const pending = useRef<AbortController | null>(null), completedImages = useRef<{index: number; source: string}[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {latest.current = props;});
  const focus = useCallback(() => {
    if (latest.current.disabled) return;
    if (latest.current.readOnly) editor.current?.root.focus(); else editor.current?.focus();
  }, []);
  useImperativeHandle(props.ref, () => ({focus}), [focus]);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const surface = document.createElement('div'); host.append(surface);
    const controller = new AbortController();
    const quill = new Quill(surface, {theme: 'snow', placeholder: '请输入内容', modules: {toolbar}, readOnly: latest.current.disabled || latest.current.readOnly});
    editor.current = quill;
    quill.root.setAttribute('role', 'textbox');
    quill.root.setAttribute('aria-multiline', 'true'); quill.root.style.minHeight = '192px';
    host.querySelectorAll('button,select,.ql-picker-label').forEach(control => {
      const format = [...control.classList, ...(control.parentElement?.classList ?? [])].find(value => value.startsWith('ql-') && labels[value.slice(3)]);
      if (format) {const label = labels[format.slice(3)]!; control.setAttribute('aria-label', label); control.setAttribute('title', label);}
    });
    async function insertImage(file: File) {
      if (pending.current || latest.current.disabled || latest.current.readOnly || controller.signal.aborted) return;
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
        if (editor.current && !latest.current.disabled && !latest.current.readOnly) selection.current = insertUploadedImage(editor.current, index, source);
        else completedImages.current.push({index, source});
      } catch (cause) {if (!uploadController.signal.aborted) setError(cause instanceof Error ? cause.message : '图片上传失败，请重试。');}
      finally {if (pending.current === uploadController) pending.current = null; busyChanged?.(false);}
    }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/svg+xml'; input.hidden = true; host.append(input);
    input.addEventListener('change', () => {const file = input.files?.[0]; if (file) void insertImage(file); input.value = '';});
    const toolbarModule = quill.getModule('toolbar') as {addHandler: (name: string, handler: () => void) => void};
    toolbarModule.addHandler('image', () => {if (!latest.current.disabled && !latest.current.readOnly && !pending.current) input.click();});
    function paste(event: ClipboardEvent) {
      if (latest.current.disabled || latest.current.readOnly) return;
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
    function readonlySelect(event: KeyboardEvent) {
      if (!latest.current.readOnly || latest.current.disabled || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
      event.preventDefault();
      const range = document.createRange(); range.selectNodeContents(quill.root);
      const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range);
    }
    quill.root.addEventListener('keydown', readonlySelect);
    function disabledFocus() {if (latest.current.disabled) quill.root.blur();}
    quill.root.addEventListener('focus', disabledFocus);
    function closedPickerEscape(event: KeyboardEvent) {
      if(event.key!=='Escape'||event.isComposing||!(event.target instanceof Element))return;
      const picker=event.target.closest('.ql-picker');
      // Quill cancels Escape even on a closed picker. Let the browser's native
      // dialog cancellation run, without invoking that closed child's handler.
      if(picker&&!picker.classList.contains('ql-expanded'))event.stopPropagation();
    }
    host.addEventListener('keydown',closedPickerEscape,true);
    function change() {const clean = quill.getLength() === 1 ? '' : sanitizeNoticeHtml(quill.getSemanticHTML()); emitted.current = clean; latest.current.onChange(clean);}
    quill.on('text-change', change);
    function selected(range: {index: number; length: number} | null) {if (range) selection.current = {index: range.index, length: range.length};}
    quill.on('selection-change', selected);
    const incoming = sanitizeNoticeHtml(latest.current.value); if (incoming !== received.current) {received.current = incoming; emitted.current = incoming;}
    quill.clipboard.dangerouslyPasteHTML(emitted.current, 'silent');
    if (selection.current) quill.setSelection(Math.min(selection.current.index, quill.getLength() - 1), selection.current.length, 'silent');
    return () => {controller.abort(); quill.off('text-change', change); quill.off('selection-change', selected); quill.root.removeEventListener('paste', paste, true); quill.root.removeEventListener('keydown', readonlySelect); quill.root.removeEventListener('focus', disabledFocus); host.removeEventListener('keydown',closedPickerEscape,true); editor.current = null; host.replaceChildren();};
  }, []);
  useEffect(() => {
    const quill = editor.current; if (!quill) return;
    const locked = !!(props.disabled || props.readOnly);
    quill.enable(!locked);
    // Quill disables editing, but its native toolbar and popup controls need the
    // same boundary. Readonly text remains focusable for selection and copying.
    const host = container.current!;
    const toolbarElement = host.querySelector<HTMLElement>('.ql-toolbar');
    if (toolbarElement) {toolbarElement.inert = locked; toolbarElement.setAttribute('aria-label', `${label}格式`);}
    host.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button,select,input').forEach(control => {control.disabled = locked;});
    const tooltip = host.querySelector<HTMLElement>('.ql-tooltip');
    if (tooltip) {tooltip.inert = locked; if (locked) tooltip.classList.add('ql-hidden');}
    if (locked) host.querySelectorAll('.ql-picker.ql-expanded').forEach(picker => {
      picker.classList.remove('ql-expanded');
      picker.querySelector('.ql-picker-label')?.setAttribute('aria-expanded', 'false');
      picker.querySelector('.ql-picker-options')?.setAttribute('aria-hidden', 'true');
    });
    quill.root.id = id;
    quill.root.setAttribute('aria-labelledby', `${id}-label`);
    quill.root.setAttribute('aria-readonly', String(!!props.readOnly));
    quill.root.setAttribute('aria-disabled', String(!!props.disabled));
    quill.root.setAttribute('aria-required', String(!!props.required));
    quill.root.setAttribute('aria-invalid', String(!!(props.fieldError || error)));
    const describedBy = [props.hint && `${id}-hint`, props.fieldError && `${id}-error`, error && `${id}-upload-error`].filter(Boolean).join(' ');
    if (describedBy) quill.root.setAttribute('aria-describedby', describedBy); else quill.root.removeAttribute('aria-describedby');
    quill.root.tabIndex = props.disabled ? -1 : 0;
    if (props.disabled) quill.root.blur();
    const clean = sanitizeNoticeHtml(props.value);
    if (clean !== received.current) {received.current = clean; if (clean !== emitted.current) {emitted.current = clean; quill.clipboard.dangerouslyPasteHTML(clean, 'silent');}}
    if (!locked) for (const image of completedImages.current.splice(0)) selection.current = insertUploadedImage(quill, image.index, image.source);
  }, [props.value, props.disabled, props.readOnly, props.required, props.hint, props.fieldError, error, id, label]);
  return <div className="rich-text-editor" data-disabled={props.disabled || undefined} data-readonly={props.readOnly || undefined} data-invalid={!!(props.fieldError || error) || undefined}>
    {props.label ? <label id={`${id}-label`} htmlFor={id} onClick={event=>{event.preventDefault();focus();}}>{props.required && <span aria-hidden="true" className="ui-required">*</span>}{label}</label>
      : <span id={`${id}-label`} className="rich-text-default-label">{label}</span>}
    <div ref={container} />
    {props.hint && <div id={`${id}-hint`} className="ui-field-hint">{props.hint}</div>}
    {props.fieldError && <div id={`${id}-error`} className="ui-field-error" role="alert">{props.fieldError}</div>}
    {error && <div id={`${id}-upload-error`} className="ui-field-error" role="alert">{error}</div>}
  </div>;
}
