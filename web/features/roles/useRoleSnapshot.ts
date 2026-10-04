import {useCallback, useRef, useState} from 'react';
import {useApplicationControls} from '../../app/context';
import {errorMessage} from '../../integration/errors';

/** A committed write and a subsequent bootstrap refresh have separate outcomes. */
export function useRoleSnapshot() {
  const {refresh} = useApplicationControls(); const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const refreshSnapshot = useCallback(async () => {
    const operation = ++generation.current;
    setBusy(true); setError('');
    try { await refresh(); } catch (cause) { if (operation === generation.current) setError(errorMessage(cause)); }
    finally { if (operation === generation.current) setBusy(false); }
  }, [refresh]);
  return {error, busy, refresh: refreshSnapshot};
}
