import {NativeButton, NativeInput} from './native';
import {useId, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {Button} from './controls';
import {grantForest, grantState, linkedSeeds, submittedGrants, toggleGrant, type GrantBranch, type GrantNode} from './tree-selection';

export function SelectionTree({label, kind, nodes, selected, linked, disabled, initiallyExpanded = false, onChange, onLinkedChange}: {
  label: string; kind: string; nodes: GrantNode[]; selected: string[]; linked: boolean; disabled: boolean;
  initiallyExpanded?: boolean; onChange: (keys: string[]) => void; onLinkedChange: (linked: boolean, keys: string[]) => void;
}) {
  const identity = useId(); const fieldset = useRef<HTMLFieldSetElement>(null);
  const forest = useMemo(() => grantForest(nodes), [nodes]);
  const state = useMemo(() => grantState(nodes, selected, linked), [nodes, selected, linked]);
  const branches = nodes.filter(node => nodes.some(child => child.parentKey === node.key));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initiallyExpanded ? [] : branches.map(node => node.key)));
  const known = new Set(nodes.map(node => node.key)); const unknown = selected.filter(key => !known.has(key));
  function expand(key: string, open: boolean) { setCollapsed(previous => { const next = new Set(previous); if (open) next.delete(key); else next.add(key); return next; }); }
  function focus(key: string) { Array.from(fieldset.current?.querySelectorAll<HTMLInputElement>('[data-grant-key]') ?? []).find(element => element.dataset.grantKey === key)?.focus(); }
  function keyboard(event: KeyboardEvent<HTMLInputElement>, node: GrantBranch) {
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const visible = Array.from(fieldset.current?.querySelectorAll<HTMLInputElement>('[data-grant-key]') ?? []).filter(element => element.getClientRects().length > 0);
      const index = visible.indexOf(event.currentTarget);
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      visible[target]?.focus();
    } else if (event.key === 'ArrowRight' && node.children.length) {
      event.preventDefault(); if (collapsed.has(node.key)) expand(node.key, true); else if (node.children[0]) focus(node.children[0].key);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault(); if (node.children.length && !collapsed.has(node.key)) expand(node.key, false); else if (node.parentKey) focus(node.parentKey);
    }
  }
  function branch(node: GrantBranch) {
    const isHalf = state.half.has(node.key), checked = state.full.has(node.key), open = !collapsed.has(node.key);
    return <li key={node.key} role="treeitem" aria-checked={isHalf ? 'mixed' : checked} aria-expanded={node.children.length ? open : undefined}>
      <div className="grant-row">{node.children.length ? <NativeButton type="button" disabled={disabled} aria-label={`${open ? '折叠' : '展开'}${kind} ${node.path}`} aria-expanded={open} aria-controls={`${identity}-${node.key}`} onClick={() => expand(node.key, !open)}>{open ? '▾' : '▸'}</NativeButton> : <span className="grant-spacer" />}
        <label><NativeInput type="checkbox" data-grant-key={node.key} aria-label={`选择${kind} ${node.path}`} checked={checked} aria-checked={isHalf ? 'mixed' : checked}
          ref={element => { if (element) element.indeterminate = isHalf; }} disabled={disabled} onKeyDown={event => keyboard(event, node)}
          onChange={event => onChange(toggleGrant(nodes, selected, node.key, event.target.checked, linked))} />{node.label}{node.status === '1' ? '（停用）' : ''}</label>
      </div>{node.children.length ? <ul role="group" id={`${identity}-${node.key}`} hidden={!open}>{node.children.map(branch)}</ul> : null}
    </li>;
  }
  return <fieldset ref={fieldset} className="grant-fieldset" disabled={disabled}><legend>{label}</legend><div className="grant-toolbar">
    <Button label={`展开全部${kind}`} size="sm" variant="ghost" isDisabled={disabled} onClick={() => setCollapsed(new Set())} />
    <Button label={`折叠全部${kind}`} size="sm" variant="ghost" isDisabled={disabled} onClick={() => setCollapsed(new Set(branches.map(node => node.key)))} />
    <Button label={`全选${kind}`} size="sm" variant="ghost" isDisabled={disabled} onClick={() => onChange([...new Set([...nodes.map(node => node.key), ...unknown])])} />
    <Button label={`清空${kind}`} size="sm" variant="ghost" isDisabled={disabled} onClick={() => onChange([])} />
    <label><NativeInput type="checkbox" aria-label={`${kind}父子联动`} checked={linked} disabled={disabled} onChange={event => {
      const raw = submittedGrants(nodes, selected, linked); onLinkedChange(event.target.checked, event.target.checked ? linkedSeeds(nodes, raw) : raw);
    }} />父子联动</label>
  </div>{forest.length ? <ul role="tree" aria-label={`${label}选择`} className="grant-tree">{forest.map(branch)}</ul> : <p>暂无可分配的{kind}。</p>}
    {unknown.map(key => <label className="grant-unavailable" key={key}><NativeInput type="checkbox" checked disabled={disabled} onChange={() => onChange(selected.filter(value => value !== key))} />当前已分配的{kind}（{key}）</label>)}
  </fieldset>;
}
