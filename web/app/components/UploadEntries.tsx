import {NativeButton} from '../../ui/native';
import {useRef, type ReactNode} from 'react';

export function UploadEntries({paths, disabled, onChange, children}: {
  paths: readonly string[]; disabled: boolean; onChange: (paths: string[]) => void;
  children: (path: string, index: number) => ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{from: number; to: number; pointer: number} | null>(null);
  function move(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= paths.length) return;
    const next = [...paths], item = next.splice(from, 1)[0];
    if (item !== undefined) {next.splice(to, 0, item); onChange(next);}
  }
  return <div ref={list} className="generated-upload-list">{paths.map((path, index) =>
    <div className="generated-upload-entry" key={`${index}-${path}`} data-upload-index={index}>
      <NativeButton type="button" className="generated-upload-handle" disabled={disabled}
        aria-label={`拖动文件 ${index + 1} 排序`} title="拖动排序，或使用方向键调整顺序"
        onKeyDown={event => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault(); const to = index + (event.key === 'ArrowUp' ? -1 : 1);
            move(index, to);
            requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-upload-index="${to}"] .generated-upload-handle`)?.focus());
          }
        }}
        onPointerDown={event => {
          if (disabled || event.button !== 0) return;
          drag.current = {from: index, to: index, pointer: event.pointerId};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const active = drag.current; if (!active || active.pointer !== event.pointerId) return;
          const entries = list.current?.querySelectorAll<HTMLElement>('[data-upload-index]');
          for (const entry of entries ?? []) {
            const bounds = entry.getBoundingClientRect();
            if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) active.to = Number(entry.dataset.uploadIndex);
          }
        }}
        onPointerUp={event => {
          const active = drag.current; drag.current = null;
          if (active?.pointer === event.pointerId) move(active.from, active.to);
        }}
        onPointerCancel={() => {drag.current = null;}}
        onLostPointerCapture={() => {drag.current = null;}}>↕</NativeButton>
      {children(path, index)}
    </div>)}</div>;
}
