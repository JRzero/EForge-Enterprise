import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider, Button, Input, Checkbox, Switch, Badge, Avatar, Card, Divider, Tooltip, Popover, EmptyState, Skeleton, Spinner, TextArea, Heading, Text, HStack, VStack, FormLayout, FileInput, Dialog, DropdownMenu, Toast, Pagination, Selector, Field, Stack} from '../ui/controls';
import {FrontendLayout, ListPage, ListFilters, ListToolbar, FormPage, PageForm, FormSection, DataTable, Feedback, Tag, BrandMark, UiIcon, ResourceDialog, ListPagination, ColumnVisibilityMenu, ImagePreview, UploadEntries, ResourceFileLinks, AccountAvatar, DictionaryTag, TagNavigation, TagMenu, type TagTone, type VisibilityState, NativeInput, Select} from '../ui';
import {AccountLayout, PasswordField} from '../ui/account';
import {IconPicker, SelectionTree, RichTextEditor, RichTextContent} from '../ui/editors';
import {AnimatedNumber, ChartCard} from '../ui/charts';
import {AppShell, DetailPage, DashboardPage, WorkbenchPage, PermissionProvider, PermissionGate} from '../ui/patterns';
import '../ui/theme.css';
import './showcase.css';

const sections = [
  ['overview','应用概览','页面模板与公共组件的可交互展示'],
  ['list','列表模板','查询、列显示、分页与详情弹窗'],
  ['form','表单模板','分组、校验和保存反馈'],
  ['detail','详情模板','业务详情、状态和操作记录'],
  ['account','账户模板','登录、注册与密码输入'],
  ['controls','基础组件','按钮、输入、选择、标签与排版'],
  ['feedback','反馈与弹层','空状态、加载、提示与弹窗'],
  ['workspace','导航与页签','溢出滚动、关闭与菜单'],
  ['shell','管理外壳模板','侧栏、工作台和权限展示'],
  ['advanced','更多交互组件','下拉菜单、消息、对话框与分页'],
  ['editors','树与编辑器','联动选择、图标与富文本'],
  ['charts','图表看板','指标、趋势、分布与可访问数据'],
  ['files','文件与图片','本地文件、排序和预览'],
] as const;
type Section = typeof sections[number][0];
const tones: TagTone[]=['primary','success','warning','danger','info'];
const sampleRows=Array.from({length:24},(_,i)=>({id:String(i+1),name:['星河科技','远山设计','青禾服务'][i%3]+` ${i+1}`,email:`contact${i+1}@example.com`,status:i%3?'正常':'停用'}));
function Block({title,note,children}:{title:string;note?:string;children:ReactNode}){return <section className="showcase-block"><h2>{title}</h2>{note&&<p className="showcase-note">{note}</p>}{children}</section>;}

function ListDemo(){
  const [draft,setDraft]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[size,setSize]=useState(10),[visibility,setVisibility]=useState<VisibilityState>({}),[detail,setDetail]=useState<typeof sampleRows[number]|null>(null);
  const rows=sampleRows.filter(row=>row.name.includes(query));
  return <ListPage title="客户列表"><ListFilters onSubmit={e=>{e.preventDefault();setQuery(draft);setPage(1);}} actions={<><Button label="查询" type="submit" variant="primary"/><Button label="重置" variant="secondary" onClick={()=>{setDraft('');setQuery('');setPage(1);}}/></>}><Input label="客户名称" value={draft} onChange={setDraft}/></ListFilters>
    <ListToolbar><Tag>{rows.length} 位客户</Tag><ColumnVisibilityMenu labels={{name:'客户名称',email:'邮箱',status:'状态'}} visibility={visibility} onChange={setVisibility}/></ListToolbar>
    <DataTable data={rows.slice((page-1)*size,page*size)} columns={[
      ...(!visibility.name&&visibility.name!==undefined?[]:[{accessorKey:'name',header:'客户名称'}]),
      ...(visibility.email===false?[]:[{accessorKey:'email',header:'邮箱'}]),
      ...(visibility.status===false?[]:[{accessorKey:'status',header:'状态',cell:({row}:{row:{original:typeof sampleRows[number]}})=><Tag tone={row.original.status==='正常'?'success':'info'}>{row.original.status}</Tag>}]),
      {id:'actions',header:'操作',cell:({row})=><Button label="查看详情" variant="ghost" onClick={()=>setDetail(row.original)}/>}
    ]} getRowId={row=>row.id} pagination={false}/>
    <ListPagination page={page} pageSize={size} total={rows.length} loading={false} onPage={setPage} onSize={setSize}/>
    {detail&&<ResourceDialog titleId="customer-detail" busy={false} onCancel={()=>setDetail(null)}><h2 id="customer-detail">客户详情</h2><dl><dt>名称</dt><dd>{detail.name}</dd><dt>邮箱</dt><dd>{detail.email}</dd></dl><Button label="关闭详情" onClick={()=>setDetail(null)}/></ResourceDialog>}
  </ListPage>;
}
function FormDemo(){
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[remark,setRemark]=useState(''),[enabled,setEnabled]=useState(true),[message,setMessage]=useState('');
  return <FormPage title="新增客户" description="本地演示，保存不会发送网络请求。"><PageForm onSubmit={e=>{e.preventDefault();setMessage(name.trim()?`已保存：${name}`:'请填写客户名称');}} actions={<><Button label="清空表单" variant="secondary" onClick={()=>{setName('');setEmail('');setRemark('');setMessage('');}}/><Button label="保存客户" type="submit" variant="primary"/></>}>
    <FormSection title="基本信息"><Input label="客户名称" value={name} onChange={setName} isRequired/><Input label="电子邮箱" type="email" value={email} onChange={setEmail}/></FormSection>
    <FormSection title="业务设置"><Switch label="启用客户" value={enabled} onChange={setEnabled}/><TextArea label="备注" value={remark} onChange={setRemark}/></FormSection>
    {message&&<Feedback tone="success">{message}</Feedback>}
  </PageForm></FormPage>;
}
function DetailDemo(){return <DetailPage title="企业服务平台" description="项目详情模板" sidebar={<Tag tone="success">进行中</Tag>}><div className="showcase-row"><Tag tone="success">进行中</Tag><span>EF-2026-001</span></div><dl className="showcase-description"><dt>项目名称</dt><dd>企业服务平台</dd><dt>负责人</dt><dd>林小禾</dd><dt>客户</dt><dd>星河科技</dd><dt>开始日期</dt><dd>2026-10-01</dd></dl><h3>处理记录</h3><ol><li>创建项目 · 10月1日</li><li>完成需求确认 · 10月3日</li><li>界面验收中 · 10月9日</li></ol></DetailPage>;}
function AccountDemo(){const [register,setRegister]=useState(false),[name,setName]=useState(''),[password,setPassword]=useState(''),[done,setDone]=useState(false);return <div className="showcase-account"><AccountLayout><h2>{register?'注册账户':'登录工作空间'}</h2><p>演示模式，请勿输入真实密码。</p><PageForm onSubmit={e=>{e.preventDefault();setDone(true);}} actions={<Button label={register?'模拟注册':'模拟登录'} type="submit" variant="primary"/>}><Input label="演示账号" value={name} onChange={setName} isRequired/><PasswordField label="演示密码" value={password} onChange={setPassword} isRequired/></PageForm><Button label={register?'切换登录':'切换注册'} variant="ghost" onClick={()=>{setRegister(!register);setDone(false);}}/>{done&&<Feedback tone="success">演示操作成功，未建立真实会话。</Feedback>}</AccountLayout></div>;}
function ControlsDemo(){const [value,setValue]=useState(''),[check,setCheck]=useState(false),[on,setOn]=useState(true),[tag,setTag]=useState(true);return <>
  <Block title="按钮" note="默认、悬停、禁用与文本操作"><div className="showcase-row">{(['primary','secondary','ghost'] as const).map(variant=><Button key={variant} label={{primary:'主要按钮',secondary:'次要按钮',ghost:'文本按钮'}[variant]} variant={variant}/>) }<Button label="禁用按钮" isDisabled/><Tooltip content="可使用键盘聚焦查看提示"><Button label="悬停提示" variant="secondary"/></Tooltip></div></Block>
  <Block title="输入与选择"><FormLayout><div className="showcase-grid"><Input label="文本输入" placeholder="请输入内容" value={value} onChange={setValue}/><Input label="禁用输入" value="不可编辑" isDisabled/><TextArea label="多行文本" value={value} onChange={setValue}/><label>原生选择<Select defaultValue="normal"><option value="normal">正常</option><option>停用</option></Select></label><Field label="日期" inputID="sample-date"><NativeInput id="sample-date" type="date" defaultValue="2026-10-09"/></Field><Selector label="组件选择器" options={['客户','项目','部门']} value={value} onChange={setValue}/><label>数量<NativeInput type="number" min="0" defaultValue="5"/></label><Checkbox label="接收通知" value={check} onChange={setCheck}/><Switch label="启用功能" value={on} onChange={setOn}/></div></FormLayout></Block>
  <Block title="标签、徽标与头像"><div className="showcase-row">{tones.map(t=><Tag tone={t} key={t}>{({primary:'主要',success:'成功',warning:'警告',danger:'危险',info:'信息'})[t]}</Tag>)}{tag?<Tag onClose={()=>setTag(false)}>可关闭</Tag>:<Button label="还原标签" onClick={()=>setTag(true)}/>}<Badge label="新消息"/><Avatar name="林小禾"/><AccountAvatar user={{id:'1',username:'demo',displayName:'示例用户'}}/></div><p>字典映射：<DictionaryTag options={[{value:'0',label:'正常',style:'SUCCESS',defaultEntry:true}]} value="0"/></p></Block>
  <Block title="卡片与排版"><Card><Stack><VStack><Heading level={3}>内容卡片</Heading><Text>标题、正文和分隔线使用公共组件。</Text><Divider/><HStack><BrandMark/><Text>EForge Enterprise</Text></HStack></VStack></Stack></Card></Block>
  <Block title="图标"><div className="showcase-row">{(['menu','settings','search','fullscreen','code','help','bell','lock','logout','chevron'] as const).map(name=><span key={name} title={name}><UiIcon name={name}/></span>)}</div></Block>
</>;}
function FeedbackDemo(){const [dialog,setDialog]=useState(false),[loaded,setLoaded]=useState(false);return <>
  <Block title="提示反馈">{tones.map(t=><Feedback tone={t} key={t}>{({primary:'操作提示',success:'保存成功',warning:'请检查必填信息',danger:'请求失败，可以重试',info:'此处展示说明信息'})[t]}</Feedback>)}</Block>
  <Block title="空状态与加载"><EmptyState title="暂无数据" description="添加第一条记录开始使用。" actions={<Button label={loaded?'重新加载演示':'完成加载演示'} onClick={()=>setLoaded(!loaded)}/>}/>{loaded?<Feedback tone="success">演示数据已加载</Feedback>:<><Spinner/><Skeleton/></>}</Block>
  <Block title="弹窗与浮层"><div className="showcase-row"><Button label="打开示例弹窗" onClick={()=>setDialog(true)}/><Popover content={<p>这是一段补充说明。</p>} label="说明浮层"><Button label="打开说明" variant="secondary"/></Popover></div>{dialog&&<ResourceDialog titleId="demo-dialog" busy={false} onCancel={()=>setDialog(false)}><h2 id="demo-dialog">示例弹窗</h2><p>支持 Esc 关闭、焦点返回、拖动和调整大小。</p><div className="post-dialog-actions"><Button label="取消" variant="secondary" onClick={()=>setDialog(false)}/><Button label="确认" variant="primary" onClick={()=>setDialog(false)}/></div></ResourceDialog>}</Block>
</>;}
function WorkspaceDemo(){const [items,setItems]=useState(Array.from({length:12},(_,i)=>({path:`demo-${i}`,href:`#demo-${i}`,title:i?'业务页面 '+i:'工作台',affix:i===0}))),[active,setActive]=useState('demo-0'),[expanded,setExpanded]=useState(false),[persist,setPersist]=useState(false),[scroll,setScroll]=useState({left:false,right:false}),[message,setMessage]=useState('');const strip=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|null>(null);
  useEffect(()=>{const el=strip.current;if(!el)return;const update=()=>setScroll({left:el.scrollLeft>1,right:el.scrollLeft+el.clientWidth<el.scrollWidth-1});update();el.addEventListener('scroll',update);const observer=new ResizeObserver(update);observer.observe(el);return()=>{el.removeEventListener('scroll',update);observer.disconnect();};},[items]);
  useEffect(()=>{if(expanded)menu.current?.querySelector<HTMLButtonElement>('button')?.focus();},[expanded]);
  return <Block title="工作区页签" note="横向滚动、键盘 Home/End、右键菜单和关闭均可操作；记住标签仅演示开关。"><div className="showcase-workspace"><TagNavigation items={items} activePath={active} stripRef={strip} scroll={scroll} expanded={expanded} persist={persist} canRefresh={true} onNavigate={item=>setActive(item.path)} onClose={item=>{setItems(rows=>rows.filter(r=>r.path!==item.path));if(active===item.path)setActive('demo-0');}} onContextMenu={(_,e)=>{opener.current=e.currentTarget;setExpanded(true);}} onActions={e=>{opener.current=e.currentTarget;setExpanded(!expanded);}} onRefresh={()=>setMessage('当前示例页面已刷新')} onPersist={setPersist}/>{expanded&&<TagMenu menuRef={menu} onDismiss={()=>{setExpanded(false);opener.current?.focus();}} actions={[{id:'refresh',label:'刷新页面',onSelect:()=>{setMessage('当前示例页面已刷新');setExpanded(false);}},{id:'close',label:'关闭其他',onSelect:()=>{setItems(rows=>rows.filter(r=>r.affix||r.path===active));setExpanded(false);}}]}/>}</div>{message&&<Feedback>{message}</Feedback>}<p>当前页签：{items.find(i=>i.path===active)?.title}</p><a href="/" target="_blank" rel="noreferrer">打开完整管理外壳（需要登录）</a></Block>;
}
function EditorsDemo(){const [selected,setSelected]=useState<string[]>([]),[linked,setLinked]=useState(true),[icon,setIcon]=useState('user'),[html,setHtml]=useState('<p><strong>欢迎使用 EForge</strong>，这里可以编辑公告内容。</p>');return <>
  <Block title="树形选择"><SelectionTree label="部门选择" kind="部门" nodes={[{key:'root',label:'示例公司'},{key:'dev',parentKey:'root',label:'研发部'},{key:'design',parentKey:'root',label:'设计部'}]} selected={selected} linked={linked} disabled={false} initiallyExpanded onChange={setSelected} onLinkedChange={(v,keys)=>{setLinked(v);setSelected(keys);}}/><p>已选：{selected.join('、')||'无'}</p></Block>
  <Block title="图标选择"><IconPicker value={icon} disabled={false} onChange={setIcon}/></Block>
  <Block title="富文本编辑" note="图片上传在演示中使用固定本地图标，不会上传文件到服务器。"><RichTextEditor value={html} onChange={setHtml} uploadImage={async()=>'/eforge-mark.svg'}/><h3>安全预览</h3><RichTextContent html={html}/></Block>
</>;}
function ChartsDemo(){return <><div className="showcase-grid">{[['客户总数',1280],['本月新增',126],['进行中项目',48]].map(([label,value])=><Block key={label} title={String(label)}><AnimatedNumber total={Number(value)} duration={400}/></Block>)}</div><div className="showcase-grid">{(['bar','line','pie','radar'] as const).map(type=><ChartCard key={type} spec={{title:{bar:'月度业务',line:'增长趋势',pie:'客户分布',radar:'交付能力'}[type],label:`示例${type}图`,legend:type==='pie'?['一月','二月','三月']:['业务'],headers:['分类','数量'],rows:type==='radar'?[['质量',80],['效率',90],['服务',75]]:[['一月',30],['二月',55],['三月',42]],option:type==='radar'?{legend:{show:false},radar:{indicator:[{name:'质量',max:100},{name:'效率',max:100},{name:'服务',max:100}]},series:[{type:'radar',name:'业务',data:[{value:[80,90,75],name:'业务'}]}]}:type==='pie'?{legend:{show:false},series:[{type:'pie',name:'业务',data:[{name:'一月',value:30},{name:'二月',value:55},{name:'三月',value:42}]}]}:{legend:{show:false},xAxis:{type:'category',data:['一月','二月','三月']},yAxis:{type:'value'},series:[{type,name:'业务',data:[30,55,42],itemStyle:{color:'#2468f2'}}]}}}/>)}</div></>;}
function FilesDemo(){const [files,setFiles]=useState<File|File[]|null>(null),[paths,setPaths]=useState(['/eforge-mark.svg','/sample-readme.txt']);return <><Block title="文件选择" note="文件只保留在当前页面内存中，不会上传。"><FileInput label="选择演示文件" value={files} onChange={setFiles} isMultiple/><p>{files?(Array.isArray(files)?files:[files]).map(f=>f.name).join('、'):'尚未选择文件'}</p></Block><Block title="图片预览"><ImagePreview src="/eforge-mark.svg" label="EForge 标志"/></Block><Block title="附件排序与下载"><UploadEntries paths={paths} disabled={false} onChange={setPaths}>{path=><ResourceFileLinks src={path}/>}</UploadEntries></Block></>;}
function ShellDemo(){const [allowed,setAllowed]=useState(true);return <><Block title="管理外壳与工作台" note="使用实际 AppShell / WorkbenchPage；完整登录外壳仍在管理入口。"><div className="showcase-shell"><AppShell sidebarWidth={150} brand={<span>示例工作区</span>} navigation={<nav><a href="#shell">工作台</a><a href="#list">客户列表</a></nav>} header={<span>工作台 / 业务概览</span>}><WorkbenchPage title="欢迎回来" description="工作台模板" left={<Tag>待办 3</Tag>} right={<Tag tone="success">运行正常</Tag>}><p>这里放置快捷入口、工作提醒和近期动态。</p></WorkbenchPage></AppShell></div></Block><Block title="权限组件" note="只演示界面显隐；真实业务仍必须由后端校验权限。"><Switch label="允许查看示例内容" value={allowed} onChange={setAllowed}/><PermissionProvider permissions={allowed?['sample:view']:[]}><PermissionGate permission="sample:view" fallback={<Feedback tone="warning">当前没有查看权限</Feedback>}><Feedback tone="success">你可以查看这段示例内容</Feedback></PermissionGate></PermissionProvider></Block></>;}
function AdvancedDemo(){const [open,setOpen]=useState(false),[toast,setToast]=useState(false),[page,setPage]=useState(1),[message,setMessage]=useState('');return <>
  <Block title="下拉操作"><DropdownMenu button={{label:'更多操作',variant:'secondary'}} items={[{id:'copy',label:'复制示例名称',onClick:()=>setMessage('已选择复制操作（演示）')},{id:'export',label:'导出示例',onClick:()=>setMessage('已选择导出操作（演示）')},{id:'disabled',label:'不可用操作',isDisabled:true}]}/>{message&&<Feedback>{message}</Feedback>}</Block>
  <Block title="基础对话框与消息"><div className="showcase-row"><Button label="打开基础对话框" onClick={()=>setOpen(true)}/><Button label="显示消息" onClick={()=>setToast(true)}/></div><Dialog isOpen={open} onOpenChange={setOpen}><h2>基础对话框</h2><p>适用于轻量确认和说明。</p><Button label="关闭基础对话框" onClick={()=>setOpen(false)}/></Dialog>{toast&&<Toast type="info" body="演示消息已显示" isAutoHide={false} autoHideDuration={4000} onDismiss={()=>setToast(false)}/>}</Block>
  <Block title="基础分页"><Pagination page={page} onChange={setPage} totalItems={120} pageSize={10}/><p>当前第 {page} 页</p></Block>
</>;}
function Showcase(){const initial=()=>sections.some(s=>s[0]===location.hash.slice(1))?location.hash.slice(1) as Section:'overview';const [section,setSection]=useState<Section>(initial),[search,setSearch]=useState('');
  useEffect(()=>{const change=()=>setSection(initial());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  const current=sections.find(s=>s[0]===section)!;
  function navigate(id:Section){location.hash=id;setSection(id);}
  return <EForgeProvider><FrontendLayout brand={<a href="#overview"><BrandMark/>EForge 示例应用</a>} navigation={[{id:'overview',title:'展示中心',href:'#overview'},{id:'frontend',title:'前台模板',href:'/frontend-template.html'}]} activeHref="#overview" onNavigate={href=>href==='#overview'?navigate('overview'):location.assign(href)} footer="EForge Enterprise · 本地示例数据，不连接业务数据库">
    <div className="showcase-layout"><aside className="showcase-sidebar"><Input label="查找示例" value={search} onChange={setSearch} placeholder="模板、按钮、图表…"/><nav aria-label="示例分类">{sections.filter(s=>(s[1]+s[2]).includes(search)).map(([id,title])=><a key={id} href={`#${id}`} aria-current={section===id?'page':undefined}>{title}</a>)}</nav>{!sections.some(s=>(s[1]+s[2]).includes(search))&&<p>没有匹配的示例</p>}</aside>
    <div className="showcase-main" key={section}><header className="showcase-heading"><span>EFORGE / SHOWCASE</span><h1>{current[1]}</h1><p>{current[2]}</p></header>
    {section==='overview'?<><div className="showcase-hero"><BrandMark/><div><h2>从一个页面，开始你的应用</h2><p>浏览模板、操作组件，再将同一套公共组件用于业务页面。</p><Button label="体验列表模板" variant="primary" onClick={()=>navigate('list')}/></div></div><div className="showcase-grid">{sections.slice(1).map(([id,title,note])=><a className="showcase-tile" href={`#${id}`} key={id}><h2>{title}<span>↗</span></h2><p>{note}</p></a>)}</div></>:section==='list'?<ListDemo/>:section==='form'?<FormDemo/>:section==='detail'?<DetailDemo/>:section==='account'?<AccountDemo/>:section==='controls'?<ControlsDemo/>:section==='feedback'?<FeedbackDemo/>:section==='workspace'?<WorkspaceDemo/>:section==='shell'?<ShellDemo/>:section==='advanced'?<AdvancedDemo/>:section==='editors'?<EditorsDemo/>:section==='charts'?<DashboardPage title='业务看板' description='图表与指标模板'><ChartsDemo/></DashboardPage>:<FilesDemo/>}
    </div></div>
  </FrontendLayout></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<Showcase/>);
