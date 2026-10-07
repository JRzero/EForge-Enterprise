import {describe,expect,it} from 'vitest';
import {navigationBreadcrumbs,navigationSearchPool,searchNavigation} from '../../app/components/navigation-model';
import {projectNavigation} from '../../integration/navigation';
const routes=[{id:'dashboard',path:'/dashboard',title:'工作台'},
  {id:'roles',path:'/system/roles',title:'角色管理',access:{permission:'role:list'}},
  {id:'role-users',path:'/role/users/:roleId',title:'用户授权',parentId:'roles',access:{permission:'role:list'}}];
const nodes=[{key:'home',type:'ROUTE' as const,routeId:'dashboard',label:'工作台',order:0,children:[]},
  {key:'group',type:'GROUP' as const,label:'系统管理',order:1,children:[
    {key:'roles',type:'ROUTE' as const,routeId:'roles',label:'角色管理',icon:'peoples',order:1,children:[]},
    {key:'external',type:'EXTERNAL' as const,label:'文档',externalUrl:'https://example.com/docs',order:2,children:[]}]}];
describe('authorized shell navigation tools',()=>{
  it('searches layered titles, fuzzy spelling and URL with unique stable keys and original icons',()=>{
    const pool=navigationSearchPool(projectNavigation(nodes,routes,['role:list']));
    expect(pool.map(item=>item.key)).toEqual(['home','roles','external']);
    expect(searchNavigation([{...pool[1]!,title:['Administration']}],'Adminstration').some(item=>item.key==='roles')).toBe(true);
    expect(searchNavigation(pool,'/system/roles').map(item=>item.key)).toEqual(['roles']);
    expect(searchNavigation(pool,'角色管理')).toHaveLength(1);
    expect(pool.find(item=>item.key==='roles')).toMatchObject({title:['系统管理','角色管理'],icon:'peoples'});
    expect(searchNavigation(pool,'no-such-page')).toEqual([]);
    expect(pool.find(item=>item.key==='external')?.external).toBe(true);
  });
  it('prunes revoked routes and malicious external URLs before they reach search',()=>{
    const items=projectNavigation([...nodes,{key:'bad',type:'EXTERNAL',externalUrl:'javascript:alert(1)',label:'bad',order:3,children:[]}],routes,[]);
    const pool=navigationSearchPool(items);
    expect(pool.some(item=>item.key==='roles'||item.key==='bad')).toBe(false);
    expect(pool.some(item=>item.key==='group')).toBe(false);
  });
  it('keeps groups without fake links and materializes internal route ancestry with exact long IDs',()=>{
    const items=projectNavigation(nodes,routes,['role:list']);
    expect(navigationBreadcrumbs(items,routes,{route:routes[2]!,params:{roleId:'9007199254740999'}})).toEqual([
      {key:'home',label:'工作台',href:'/dashboard'}, {key:'group',label:'系统管理',href:undefined},
      {key:'roles',label:'角色管理',href:'/system/roles'}, {key:'route:role-users',label:'用户授权',href:undefined}]);
    expect(navigationBreadcrumbs(items,routes,{route:routes[0]!,params:{}})).toEqual([{key:'home',label:'工作台',href:undefined}]);
  });
});