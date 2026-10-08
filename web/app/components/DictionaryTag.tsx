import type {DictionaryValueOption} from '../../generated/api';
import {Tag, type TagTone} from '../../ui/Tag';
import {dictionaryTags, type DictionaryValue} from './dictionary-values';
export function DictionaryTag({options, value, separator = ',', showValue = true}: {options: readonly DictionaryValueOption[]; value: DictionaryValue; separator?: string; showValue?: boolean}) {
  const tags = dictionaryTags(options, value, separator);
  return <span className="dictionary-tags">{tags.matched.map((item, index) => {
    const css = item.cssClass && /^[a-zA-Z0-9_\- ]*$/.test(item.cssClass) ? item.cssClass : '';
    return item.style === 'DEFAULT' && !css ? <span key={`${item.value}-${index}`}>{item.label}</span> : <Tag key={`${item.value}-${index}`} tone={(item.style === 'DEFAULT' ? 'info' : item.style.toLowerCase()) as TagTone} className={`dictionary-tag tag-${item.style.toLowerCase()} ${css}`.trim()}>{item.label}</Tag>;
  })}{showValue && tags.unmatched.length ? <span>{tags.unmatched.join(' ')}</span> : null}</span>;
}
