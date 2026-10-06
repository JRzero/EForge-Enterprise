import type {MenuChoice} from '../../generated/api';
/** Keep original user-scoped order and treat missing ancestors as visible roots. */
export function generatorMenuLabels(rows:readonly MenuChoice[]) {
  const byId=new Map(rows.map(row=>[row.id,row]));
  if(byId.size!==rows.length)throw new Error('菜单选项编号重复，请刷新选项。');
  return rows.map(row=>{
    const names:string[]=[],visited=new Set<string>();let cursor:MenuChoice|undefined=row;
    while(cursor){if(visited.has(cursor.id)||visited.size>=64)throw new Error('菜单层级无效，请刷新选项。');visited.add(cursor.id);names.unshift(cursor.name);cursor=byId.get(cursor.parentId);}
    return {...row,label:names.join(' / ')};
  });
}
