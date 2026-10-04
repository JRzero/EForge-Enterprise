import type {DictionaryEntryResponse, PageResponseDictionaryEntryResponse} from '../../generated/api';
export class DictionaryPreviewChangedError extends Error {
  constructor() {super('字典数据已变化，请刷新预览后重试。');}
}
export async function dictionaryPreview(load: (page: number) => Promise<PageResponseDictionaryEntryResponse>, signal: AbortSignal) {
  const rows: DictionaryEntryResponse[] = [], ids = new Set<string>(); let expected: number | undefined;
  for (let page = 1; ; page++) {
    signal.throwIfAborted(); const result = await load(page); signal.throwIfAborted();
    if (result.page !== page || result.pageSize !== 100 || !Number.isSafeInteger(result.total) || result.total < 0 || expected !== undefined && result.total !== expected) throw new DictionaryPreviewChangedError();
    expected = result.total;
    for (const row of result.items) {if (ids.has(row.id)) throw new DictionaryPreviewChangedError(); ids.add(row.id); rows.push(row);}
    if (rows.length === expected) return rows;
    if (rows.length > expected || result.items.length !== 100) throw new DictionaryPreviewChangedError();
  }
}
