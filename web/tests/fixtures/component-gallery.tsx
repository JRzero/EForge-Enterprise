import {ReferenceSelect} from '../../ui/ReferenceSelect';
import {TreeSelect} from '../../ui/TreeSelect';
import {MultiSelect} from '../../ui/MultiSelect';
import {PageTabs} from '../../ui/PageTabs';
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button,EForgeProvider,Input,Selector} from '@eforge/ui';
import '@eforge/tokens/styles.css';
import '@eforge/ui/styles.css';
import '@eforge/patterns/styles.css';
import '@eforge/data/styles.css';
import {ImagePreview} from '../../app/components/ImagePreview';
import {UploadEntries} from '../../app/components/UploadEntries';
import {GrantTree} from '../../features/roles/GrantTree';
import {IconPicker} from '../../features/menus/IconPicker';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {Select,TextareaControl} from '../../ui/native';
import '../../ui/theme.css';

// Browser-only presentation fixture. Uses the real shared components, without
// auth bootstrap, production routes, network uploads or business writes.
function Gallery(){
 const [refValue,setRefValue]=useState<string|null>('9007199254740993'),[refError,setRefError]=useState('关联加载失败');
 const [treeValue,setTreeValue]=useState<string|null>('old'),[treeError,setTreeError]=useState('树加载失败');
  const [people,setPeople]=useState(['old']),[peopleError,setPeopleError]=useState('选项加载失败');
  const [tab,setTab]=useState(0),[assignee,setAssignee]=useState<string|null>('admin');
  const [text,setText]=useState('admin'),[paths,setPaths]=useState(['合同.pdf','需求文档.docx']),[icon,setIcon]=useState('user'),[selected,setSelected]=useState(['read']),[linked,setLinked]=useState(true),[visibility,setVisibility]=useState({});
  return <EForgeProvider><main className="enterprise-layout" style={{padding:20}}>
    <section className="posts-page" style={{maxWidth:900,margin:'auto'}}><h1>共享组件样式验收</h1>
      <ReferenceSelect label="失败关联" value={refValue} onChange={setRefValue} options={[{value:'2',label:'恢复的记录'}]} error={refError} onRetry={()=>setRefError('')}/><ReferenceSelect label="加载关联" value="3" options={[]} loading onChange={()=>{throw Error('loading changed');}}/><ReferenceSelect label="只读关联" value="3" options={[]} readOnly onChange={()=>{throw Error('readonly changed');}}/><ReferenceSelect label="禁用关联" value="3" options={[]} disabled onChange={()=>{throw Error('disabled changed');}}/><TreeSelect label="失败树" value={treeValue} onChange={setTreeValue} nodes={[{value:'orphan',parentValue:'hidden',label:'范围内部门'}]} error={treeError} onRetry={()=>setTreeError('')}/><TreeSelect label="只读树" value="old" nodes={[]} readOnly onChange={()=>{throw Error('readonly changed');}}/><TreeSelect label="禁用树" value="old" nodes={[]} disabled onChange={()=>{throw Error('disabled changed');}}/><TreeSelect label="加载树" value={null} nodes={[{value:'active',label:'不可提前选择'}]} loading onChange={()=>{throw Error('loading changed');}}/><MultiSelect label="失败多选" value={people} onChange={setPeople} options={[{value:'active',label:'可选人员'}]} error={peopleError} onRetry={()=>setPeopleError('')} unknownLabel={id=>`旧人员（${id}）`}/>
      <MultiSelect label="只读多选" value={['old']} onChange={()=>{throw Error('readonly changed');}} options={[]} readOnly/>
      <MultiSelect label="禁用多选" value={['old']} onChange={()=>{throw Error('disabled changed');}} options={[]} disabled/>
      <MultiSelect label="加载多选" value={[]} onChange={()=>{throw Error('loading changed');}} options={[{value:'active',label:'可选人员'}]} loading/>
      <PageTabs label="详情页签" value={String(tab)} onChange={value=>setTab(Number(value))} items={['基本信息','费用明细','财务信息','文件信息','回款信息','审批记录'].map((label,index)=>({value:String(index),label,id:`detail-tab-${index}`,panelId:'detail-panel'}))}/>
      <div role="tabpanel" id="detail-panel" aria-labelledby={`detail-tab-${tab}`}>当前详情：{['基本信息','费用明细','财务信息','文件信息','回款信息','审批记录'][tab]}</div>
      <Selector label="审批人员" options={[{value:'admin',label:'Admin'},{value:'cindy',label:'Cindy'},{value:'sales',label:'业务人员2'},{value:'disabled',label:'停用人员',disabled:true}]} value={assignee} onChange={setAssignee} hasClear hasSearch/>
      <form className="post-filters" onSubmit={event=>event.preventDefault()}>
        <Input label="账号" value={text} onChange={setText}/><Input label="禁用账号" value="readonly" isDisabled/>
        <Input label="错误账号" value="" status={{type:'error',message:'请输入账号'}} onChange={()=>{}}/>
        <Button label="主要操作" variant="primary"/><Button label="次要操作" variant="secondary"/><Button label="禁用操作" isDisabled/>
      </form>
      <label>统一选择框<Select defaultValue="normal"><option value="normal">正常</option></Select></label>
      <label>禁用选择框<Select disabled><option>不可编辑</option></Select></label>
      <label>统一文本域<TextareaControl defaultValue="说明"/></label>
      <label>错误文本域<TextareaControl aria-invalid="true"/></label>
      <ColumnVisibilityMenu labels={{name:'名称',status:'状态',created:'创建时间'}} visibility={visibility} onChange={setVisibility}/>
      <IconPicker value={icon} disabled={false} onChange={setIcon}/>
      <GrantTree label="菜单权限" kind="菜单" initiallyExpanded nodes={[{key:'system',label:'系统管理'},{key:'read',parentKey:'system',label:'查看用户'},{key:'write',parentKey:'system',label:'修改用户'}]} selected={selected} linked={linked} disabled={false} onChange={setSelected} onLinkedChange={(value,keys)=>{setLinked(value);setSelected(keys);}}/>
      <h2>文件列表</h2><UploadEntries paths={paths} disabled={false} onChange={setPaths}>{(path,index)=><><span>{path}</span><Button label={`移除文件 ${index+1}`} variant="ghost" onClick={()=>setPaths(paths.filter((_,position)=>position!==index))}/></>}</UploadEntries>
      <h2>图片预览</h2><ImagePreview src="/tests/fixtures/avatar.png,/ruoyi-icons/v3.9.2/user.svg" label="样式示例"/>
    </section>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<Gallery/>);
