import {DataTable as EForgeDataTable, type DataTableProps} from '@eforge/data';

export * from '@eforge/data';
/** One table surface for product pages; sorting/selection remain caller-owned. */
export function DataTable<TData>(props: DataTableProps<TData>) {
  return <div className="enterprise-data-table"><EForgeDataTable emptyText="暂无数据" {...props}/></div>;
}
