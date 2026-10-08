import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {Button} from '../ui/controls';
import {useApplicationControls} from './context';
import {ResourceDialog} from './components/ResourceDialog';

/** Capture only editable values, after an asynchronous detail read has completed. */
export function captureDraft<T>(form: T) {return {form, initial: JSON.stringify(form)};}

/** Activity suspends effects, but neither a retained draft nor an unacknowledged write is disposed. */
export function usePageDraft(dirty: boolean) {
  const {setPageDirty} = useApplicationControls();
  const state = useRef({dirty, pending: 0});
  useEffect(() => {
    state.current.dirty = dirty;
    setPageDirty?.(dirty, state.current.pending > 0);
    // The workspace owns removal on a confirmed close, refresh or permission change.
  }, [dirty, setPageDirty]);
  const setDirty = useCallback((next: boolean) => {
    state.current.dirty = next;
    setPageDirty?.(next, state.current.pending > 0);
  }, [setPageDirty]);
  const beginSave = useCallback(() => {
    state.current.pending += 1;
    setPageDirty?.(state.current.dirty, true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.current.pending -= 1;
      setPageDirty?.(state.current.dirty, state.current.pending > 0);
    };
  }, [setPageDirty]);
  return {setDirty, beginSave};
}

/** Native Escape and explicit cancel share the same small discard decision. */
export function useDiscardChanges(dirty: boolean, busy: boolean) {
  const titleId = useId();
  const [proceed, setProceed] = useState<(() => void) | null>(null);
  const confirm = useCallback((action: () => void) => {
    if (busy) return;
    if (dirty) setProceed(() => action);
    else action();
  }, [dirty, busy]);
  const dialog = proceed ? <ResourceDialog titleId={titleId} alert busy={busy} onCancel={() => setProceed(null)}>
    <h2 id={titleId}>有未保存的修改</h2><p>放弃后将无法恢复这些修改。</p>
    <div className="post-row-actions">
      <Button label="继续编辑" isDisabled={busy} onClick={() => setProceed(null)} />
      <Button label="放弃修改" variant="secondary" isDisabled={busy} onClick={() => {
        if (busy) return;
        const action = proceed; setProceed(null); action();
      }} />
    </div>
  </ResourceDialog> : null;
  return {confirm, dialog};
}
