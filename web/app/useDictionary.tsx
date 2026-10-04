import {useEffect, useState} from 'react';
import {Button} from '@eforge/ui';
import type {DictionaryValueOption} from '../generated/api';
import {errorMessage} from '../integration/errors';
import {useApi} from './context';

export function useDictionary(code: string) {
  const api = useApi(), [options, setOptions] = useState<DictionaryValueOption[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setOptions([]); setError(''); setLoading(true);
    api.getDictionaryValues(code, controller.signal).then(values => {if (!controller.signal.aborted) {setOptions(values); setLoading(false);}})
      .catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);}});
    return () => controller.abort();
  }, [api, code, version]);
  return {options, error, loading, retry: () => setVersion(value => value + 1)};
}
export function DictionaryNotice({dictionary}: {dictionary: ReturnType<typeof useDictionary>}) {
  return dictionary.error ? <div role="alert"><p>字典标签加载失败：{dictionary.error}</p><Button label="重试字典标签" onClick={dictionary.retry} /></div> : null;
}
export function DictionaryOptions({options, current}: {options: readonly DictionaryValueOption[]; current?: string}) {
  return <>{current !== undefined && current !== '' && !options.some(option => option.value === current) ? <option value={current}>{current}</option> : null}
    {options.map((option, index) => <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>)}</>;
}
