import {expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {dictionaryTags} from '../../app/components/dictionary-values';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {dictionaryPreview} from '../../features/dictionaries/preview';
import type {DictionaryEntryResponse, DictionaryValueOption} from '../../generated/api';

const options: DictionaryValueOption[] = [
  {value: '0', label: '<正常>', style: 'DEFAULT', defaultEntry: true},
  {value: 'false', label: '否', style: 'WARNING', defaultEntry: false},
  {value: '0', label: '重复标签', style: 'SUCCESS', defaultEntry: true},
];
const entry = (index: number): DictionaryEntryResponse => ({id: (9007199254740993n + BigInt(index)).toString(), dictionaryId: '7', dictionaryCode: 'example', label: `标签${index}`, value: String(index), sort: index, status: '0', style: 'DEFAULT', defaultEntry: false});
const response = (items: DictionaryEntryResponse[], total: number, page = 1) => ({items, total, page, pageSize: 100});

it('dictionary tags preserve zero, false, arrays, duplicate labels and original option order', () => {
  expect(dictionaryTags(options, 0).matched).toEqual([options[0], options[2]]);
  expect(dictionaryTags(options, false).matched).toEqual([options[1]]);
  expect(dictionaryTags(options, ['false', 0, 'unknown']).matched).toEqual(options);
  expect(dictionaryTags(options, 'false|0|unknown', '|').unmatched).toEqual(['unknown']);
  for (const value of [null, undefined, '']) expect(dictionaryTags(options, value)).toEqual({matched: [], unmatched: []});
  expect(dictionaryTags([], 'unknown')).toEqual({matched: [], unmatched: []});
});

it('dictionary rendering escapes labels, supports unknown-value visibility and rejects unsafe CSS names', () => {
  const unsafe = {...options[0]!, cssClass: 'x" onclick="alert(1)'};
  const html = renderToStaticMarkup(createElement(DictionaryTag, {options: [unsafe], value: '0,unknown'}));
  expect(html).toContain('&lt;正常&gt;'); expect(html).toContain('unknown'); expect(html).not.toContain('onclick');
  expect(renderToStaticMarkup(createElement(DictionaryTag, {options, value: 'unknown', showValue: false}))).not.toContain('unknown');
  const styled = renderToStaticMarkup(createElement(DictionaryTag, {options: [{...options[1]!, cssClass: 'custom-label'}], value: false}));
  expect(styled).toContain('dictionary-tag tag-warning custom-label');
});

it('preview reads all pages beyond the first hundred while preserving exact IDs and order', async () => {
  const rows = Array.from({length: 205}, (_, index) => entry(index));
  const load = vi.fn(async (page: number) => response(rows.slice((page - 1) * 100, page * 100), rows.length, page));
  expect(await dictionaryPreview(load, new AbortController().signal)).toEqual(rows);
  expect(load.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  expect(await dictionaryPreview(async () => response([], 0), new AbortController().signal)).toEqual([]);
});

it('preview rejects total drift, duplicate IDs, short intermediate pages and invalid page metadata', async () => {
  const rows = Array.from({length: 100}, (_, index) => entry(index));
  for (const second of [response([entry(100)], 102, 2), response([entry(0)], 101, 2)]) {
    await expect(dictionaryPreview(async page => page === 1 ? response(rows, 101) : second, new AbortController().signal)).rejects.toThrow('字典数据已变化');
  }
  for (const invalid of [response([entry(0)], 101), response([], -1), response([], 0, 2), {...response([], 0), pageSize: 10}, response([entry(0)], 0), response([], Number.MAX_SAFE_INTEGER + 1)]) {
    await expect(dictionaryPreview(async () => invalid, new AbortController().signal)).rejects.toThrow('字典数据已变化');
  }
});

it('closing preview aborts before loading or before requesting another page', async () => {
  const before = new AbortController(); before.abort(); const load = vi.fn(async () => response([], 0));
  await expect(dictionaryPreview(load, before.signal)).rejects.toMatchObject({name: 'AbortError'}); expect(load).not.toHaveBeenCalled();
  const during = new AbortController();
  const pending = vi.fn(async () => {during.abort(); return response(Array.from({length: 100}, (_, index) => entry(index)), 101);});
  await expect(dictionaryPreview(pending, during.signal)).rejects.toMatchObject({name: 'AbortError'}); expect(pending).toHaveBeenCalledTimes(1);
});
