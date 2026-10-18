import type {ListViewState} from '../../ui/SavedListViews';

export function normalizePostListView(value:unknown):ListViewState|null{
  if(!value||typeof value!=='object'||!('filters' in value)||!('columns' in value))return null;
  const filters=value.filters,columns=value.columns;
  if(!filters||typeof filters!=='object'||Array.isArray(filters)||!columns||typeof columns!=='object'||Array.isArray(columns))return null;
  const normalizedFilters:Record<string,string>={};
  for(const key of ['code','name','status']){
    const field=Object.hasOwn(filters,key)?(filters as Record<string,unknown>)[key]:'';
    if(typeof field!=='string'||field.length>64||(key==='status'&&!['','0','1'].includes(field)))return null;
    normalizedFilters[key]=field;
  }
  const normalizedColumns:Record<string,boolean>={};
  for(const key of ['id','code','name','sort','status','createdAt'])if(Object.hasOwn(columns,key)){
    const visible=(columns as Record<string,unknown>)[key];if(typeof visible!=='boolean')return null;normalizedColumns[key]=visible;
  }
  return {filters:normalizedFilters,columns:normalizedColumns};
}
