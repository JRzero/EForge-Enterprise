import type {DictionaryValueOption} from '../../generated/api';
export type DictionaryValue = string | number | boolean | readonly (string | number | boolean)[] | null | undefined;
export function dictionaryTags(options: readonly DictionaryValueOption[], value: DictionaryValue, separator = ',') {
  const values = value === null || value === undefined || value === '' ? [] : typeof value === 'number' || typeof value === 'boolean' ? [value] : typeof value === 'string' ? value.split(separator) : value.map(String);
  // The original tag coerces scalar number/boolean values, but stringifies arrays.
  const matches = (option: DictionaryValueOption, item: string | number | boolean) => typeof item === 'string' ? option.value === item : Number(option.value) === Number(item);
  return {matched: options.filter(option => values.some(item => matches(option, item))),
    unmatched: options.length ? values.filter(item => !options.some(option => matches(option, item))).map(String) : []};
}
