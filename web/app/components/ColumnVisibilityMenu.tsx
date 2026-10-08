import {useEffect, useRef, type Dispatch, type SetStateAction} from 'react';
import type {VisibilityState} from '@eforge/data';

export function ColumnVisibilityMenu({labels, visibility, onChange, title = '显示列', className}: {
  labels: Record<string, string>; visibility: VisibilityState;
  onChange: Dispatch<SetStateAction<VisibilityState>>; title?: string; className?: string;
}) {
  const entries = Object.entries(labels);
  const all = entries.every(([key]) => visibility[key] !== false);
  const some = entries.some(([key]) => visibility[key] !== false);
  const master = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false; menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeEscape);
    };
  }, []);
  useEffect(() => { if (master.current) master.current.indeterminate = some && !all; }, [all, some]);
  return <details ref={menu} className={['column-visibility-menu',className].filter(Boolean).join(' ')}><summary>{title}</summary><div className="post-columns">
    <label><input ref={master} type="checkbox" checked={all} disabled={!entries.length}
      onChange={event => { const checked = event.target.checked; onChange(current => ({...current, ...Object.fromEntries(entries.map(([key]) => [key, checked]))})); }} />列展示</label>
    {entries.map(([key, label]) => <label key={key}><input type="checkbox" checked={visibility[key] !== false}
      onChange={event => { const checked = event.target.checked; onChange(current => ({...current, [key]: checked})); }} />{label}</label>)}
  </div></details>;
}
