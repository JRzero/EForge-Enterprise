import type {ListViewState} from '../ui/SavedListViews';
export function normalizeShowcaseListView(value:unknown):ListViewState|null{
  if(!value||typeof value!=='object'||!('filters' in value)||!('columns' in value))return null;
  if(!value.filters||typeof value.filters!=='object'||!value.columns||typeof value.columns!=='object')return null;
  const name='name' in value.filters?value.filters.name:'';
  if(typeof name!=='string'||name.length>100)return null;
  const columns:Record<string,boolean>={};
  for(const key of ['name','email','status'])if(Object.hasOwn(value.columns,key)){
    const field=(value.columns as Record<string,unknown>)[key];if(typeof field!=='boolean')return null;columns[key]=field;
  }
  return {filters:{name},columns};
}
