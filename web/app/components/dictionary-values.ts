import type {DictionaryValueOption} from '../../generated/api';
export type DictionaryValue = string | number | boolean | readonly (string | number | boolean)[] | null | undefined;
export function dictionaryTags(options: readonly DictionaryValueOption[], value: DictionaryValue, separator = ',') {
  const values = value === null || value === undefined || value === '' ? [] : Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(separator) : [String(value)];
  return {matched: options.filter(option => values.includes(option.value)),
    unmatched: options.length ? values.filter(item => !options.some(option => option.value === item)) : []};
}
