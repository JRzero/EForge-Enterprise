import {NativeButton} from './native';
import {useRef, useState, type KeyboardEvent} from 'react';
import {Button, Input} from './controls';
import iconNames from './icon-names.json';
const names = new Set(iconNames);
export function iconUrl(name?: string) { return name && names.has(name) ? `/ruoyi-icons/v3.9.2/${name}.svg` : undefined; }
export function MenuIcon({name}: {name?: string}) { const url = iconUrl(name); return url ? <img src={url} alt="" width={20} height={20} className="menu-icon" /> : <span aria-hidden="true" className="menu-icon">□</span>; }
export function IconPicker({value, disabled, onChange}: {value: string; disabled: boolean; onChange: (value: string) => void}) {
  const [search, setSearch] = useState(''); const details = useRef<HTMLDetailsElement>(null);
  const icons = iconNames.filter(name => name.toLowerCase().includes(search.trim().toLowerCase()));
  function close() { if (details.current) { details.current.open = false; details.current.querySelector<HTMLElement>('summary')?.focus(); } }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-icon-choice]')); const index = buttons.indexOf(event.target);
    if (index < 0) return; event.preventDefault();
    const top = buttons[0]?.getBoundingClientRect().top, columns = buttons.filter(button => button.getBoundingClientRect().top === top).length || 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns);
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  }
  return <fieldset className="menu-icon-picker" disabled={disabled}><legend>菜单图标</legend><Input label="图标名称" value={value} isDisabled={disabled} onChange={onChange} />
    <details ref={details}><summary aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}><MenuIcon name={value} />{value || '选择图标'}</summary>
      <div onKeyDown={keyboard}><Input label="搜索图标" value={search} isDisabled={disabled} onChange={setSearch} />
        <p>共 {icons.length} 个图标</p><div role="group" aria-label="可选图标" className="menu-icon-options">{icons.map(name => <NativeButton type="button" data-icon-choice key={name} disabled={disabled} aria-label={`选择图标 ${name}`} aria-pressed={value === name} onClick={() => { onChange(name); close(); }}><MenuIcon name={name} /><span>{name}</span></NativeButton>)}</div>
        {!icons.length ? <p>没有匹配的图标。</p> : null}</div>
    </details><Button label="清除图标" variant="ghost" size="sm" isDisabled={disabled || !value} onClick={() => onChange('')} />
  </fieldset>;
}
