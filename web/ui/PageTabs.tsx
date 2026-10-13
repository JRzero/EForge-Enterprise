import type {ReactNode} from 'react';
import {NativeButton} from './native';

export type PageTab = {value: string; label: ReactNode; id: string; panelId: string; disabled?: boolean};
/** Controlled tabs; panels and their mount/retention policy belong to the caller. */
export function PageTabs({label, items, value, onChange, disabled = false, className = ''}: {
  label: string; items: PageTab[]; value: string; onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const available = items.filter(item => !item.disabled);
  const focusValue = available.some(item => item.value === value) ? value : available[0]?.value;
  return <div className={`ui-page-tabs ${className}`} role="tablist" aria-label={label}>
    {items.map(item => <NativeButton key={item.value} type="button" role="tab" id={item.id} aria-controls={item.panelId}
      aria-selected={value === item.value} disabled={disabled || item.disabled} tabIndex={focusValue === item.value ? 0 : -1}
      onClick={() => onChange(item.value)} onKeyDown={event => {
        if (disabled) return;
        const index = available.findIndex(entry => entry.value === item.value);
        const position = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : event.key === 'ArrowRight' ? (index + 1) % available.length : event.key === 'ArrowLeft' ? (index + available.length - 1) % available.length : null;
        if (position === null || !available[position]) return;
        event.preventDefault(); const target = available[position]; onChange(target.value);
        const button = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]') ?? []).find(node => node.id === target.id);
        button?.focus();
      }}>{item.label}</NativeButton>)}
  </div>;
}
