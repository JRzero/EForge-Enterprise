import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider, Button, Input} from '../ui/controls';
import {FrontendLayout, FormPage, PageForm, ListPage, ListFilters, ListToolbar, BrandMark, DataTable, Feedback} from '../ui';
import '../ui/theme.css';

// Standalone front-office template with local sample data and no admin session.
function FrontendExample(){
  const [page,setPage]=useState('#customers'),[query,setQuery]=useState(''),[draft,setDraft]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[message,setMessage]=useState('');
  const [customers,setCustomers]=useState([{id:'1',name:'星河科技',email:'contact@example.com'},{id:'2',name:'远山设计',email:'design@example.com'},{id:'3',name:'青禾服务',email:'service@example.com'}]);
  return <EForgeProvider><FrontendLayout brand={<a href="#customers" onClick={event=>{event.preventDefault();setPage('#customers');}}><BrandMark/>EForge Enterprise</a>}
    navigation={[{id:'customers',title:'客户列表',href:'#customers'},{id:'new',title:'新增客户',href:'#new'}]} activeHref={page} onNavigate={setPage}
    actions={<Button label="联系我们" variant="secondary" onClick={()=>setMessage('联系邮箱：contact@example.com')}/>} footer="EForge Enterprise · 前台模板">
    {page==='#customers'?<ListPage title="客户列表" description="查看和管理客户信息。">
      <ListFilters onSubmit={event=>{event.preventDefault();setQuery(draft);}} actions={<><Button label="查询" variant="primary" type="submit"/><Button label="重置" variant="secondary" onClick={()=>{setDraft('');setQuery('');}}/></>}><Input label="关键词" value={draft} onChange={setDraft} placeholder="搜索客户名称"/></ListFilters>
      <ListToolbar><Button label="新增客户" variant="primary" onClick={()=>setPage('#new')}/><Button label="刷新" variant="secondary" onClick={()=>setQuery(draft)}/></ListToolbar>
      <DataTable data={customers.filter(row=>row.name.includes(query))} columns={[{accessorKey:'name',header:'客户名称'},{accessorKey:'email',header:'电子邮箱'}]} getRowId={row=>row.id} pagination={false}/>
    </ListPage>:<FormPage title="新增客户" description="填写客户的基本信息。"><PageForm onSubmit={event=>{event.preventDefault();setCustomers(rows=>[...rows,{id:String(rows.length+1),name:name.trim(),email}]);setName('');setEmail('');setPage('#customers');setMessage('客户已保存。');}}
      actions={<><Button label="取消" variant="secondary" onClick={()=>setPage('#customers')}/><Button label="保存客户" variant="primary" type="submit" isDisabled={!name.trim()}/></>}>
      <Input label="客户名称" value={name} onChange={setName} aria-required="true"/><Input label="电子邮箱" type="email" value={email} onChange={setEmail}/>
    </PageForm></FormPage>}
    {message?<Feedback aria-label="操作反馈">{message}</Feedback>:null}
    <p><a href="/showcase.html">浏览全部页面模板与组件示例 →</a></p>
  </FrontendLayout></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<FrontendExample/>);
