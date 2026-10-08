import {Select} from '../../ui/native';
import {useEffect, useRef} from 'react';
import {Button} from '../../ui/controls';
import {PaginationNavigation} from './PaginationNavigation';

export function Pagination({page, pageSize, total, loading, busy = false, onPage, onSize, unit = '条',
  previousLabel = '上一页', nextLabel = '下一页', sizeLabel = '每页条数', autoScroll = true}: {
  page: number; pageSize: number; total?: number; loading: boolean; busy?: boolean;
  onPage: (page: number) => void; onSize: (size: number) => void; unit?: string;
  previousLabel?: string; nextLabel?: string; sizeLabel?: string; autoScroll?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const last = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  // Undefined means no successful current result, rather than a proven empty page.
  useEffect(() => {
    if (total !== undefined && !loading && !busy && page > last) onPage(last);
  }, [total, loading, busy, page, last, onPage]);
  function scroll() {
    if (!autoScroll) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    for (let parent = root.current?.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
        parent.scrollTo({top: 0, behavior}); return;
      }
    }
    window.scrollTo({top: 0, behavior});
  }
  function move(value: number) {
    if (busy || loading || value === page || !Number.isSafeInteger(value) || value < 1 || value > last) return;
    onPage(value); scroll();
  }
  return <div ref={root} className="post-pagination"><span>共 {total ?? 0} {unit}，第 {page} 页</span>
    <label>{sizeLabel}<Select aria-label={sizeLabel} value={pageSize} disabled={busy} onChange={event => {
      const size = Number(event.target.value); if (busy || size === pageSize) return; onSize(size); onPage(1); scroll();
    }}>{[...new Set([10, 20, 30, 50, 100, pageSize])].sort((a, b) => a - b).map(size => <option key={size} value={size}>{size}</option>)}</Select></label>
    <Button label={previousLabel} variant="secondary" isDisabled={busy || loading || page <= 1} onClick={() => move(page - 1)} />
    <Button label={nextLabel} variant="secondary" isDisabled={busy || loading || page >= last} onClick={() => move(page + 1)} />
    <PaginationNavigation page={page} pageSize={pageSize} total={total ?? 0} disabled={busy || loading} onChange={move} />
  </div>;
}
