import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button,EForgeProvider,Input} from '@eforge/ui';
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
  const [text,setText]=useState('admin'),[paths,setPaths]=useState(['合同.pdf','需求文档.docx']),[icon,setIcon]=useState('user'),[selected,setSelected]=useState(['read']),[linked,setLinked]=useState(true),[visibility,setVisibility]=useState({});
  return <EForgeProvider><main className="enterprise-layout" style={{padding:20}}>
    <section className="posts-page" style={{maxWidth:900,margin:'auto'}}><h1>共享组件样式验收</h1>
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
