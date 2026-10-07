import {useSyncExternalStore} from 'react';
import {Button} from '@eforge/ui';

function subscribe(listener: () => void) {
  const query = window.matchMedia('(max-width: 991px)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function mobile() { return window.matchMedia('(max-width: 991px)').matches; }

export function PaginationNavigation({page, pageSize, total, disabled, onChange}: {
  page: number; pageSize: number; total: number; disabled: boolean; onChange: (page: number) => void;
}) {
  const compact = useSyncExternalStore(subscribe, mobile, () => false);
  const last = Math.max(1, Math.ceil(total / pageSize)), width = compact ? 5 : 7;
  const middle = width - 2;
  const start = last <= width ? 1 : Math.max(2, Math.min(page - Math.floor(middle / 2), last - middle));
  const end = last <= width ? last : start + middle - 1;
  const numbers = Array.from({length: end - start + 1}, (_, index) => start + index);
  function select(value: number) {
    if (!disabled && Number.isSafeInteger(value) && value >= 1 && value <= last && value !== page) onChange(value);
  }
  return <nav className="pagination-navigation" aria-label="分页导航">
    {start > 1 ? <><Button label="第 1 页" size="sm" variant="ghost" aria-current={page === 1 ? 'page' : undefined} isDisabled={disabled} onClick={() => select(1)} />{start > 2 ? <span aria-hidden="true">…</span> : null}</> : null}
    {numbers.map(value => <Button key={value} label={`第 ${value} 页`} size="sm" variant="ghost" aria-current={value === page ? 'page' : undefined} isDisabled={disabled} onClick={() => select(value)} />)}
    {end < last ? <>{end < last - 1 ? <span aria-hidden="true">…</span> : null}<Button label={`第 ${last} 页`} size="sm" variant="ghost" aria-current={page === last ? 'page' : undefined} isDisabled={disabled} onClick={() => select(last)} /></> : null}
    <form key={page} onSubmit={event => {event.preventDefault(); const form = event.currentTarget; if (form.reportValidity()) select(Number(new FormData(form).get('page')));}}>
      <label>跳至页码<input aria-label="跳至页码" name="page" type="number" min={1} max={last} step={1} required defaultValue={page} disabled={disabled} /></label>
      <Button label="跳转" size="sm" variant="ghost" type="submit" isDisabled={disabled} />
    </form>
  </nav>;
}
