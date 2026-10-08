import {NativeButton, Select, TextareaControl, Table, NativeInput} from '../../ui/native';
import {PageForm} from '../../ui/FormPage';
import {ListToolbar} from '../../app/components/ListPage';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Button, Input} from '../../ui/controls';
import type {GeneratorConfigurationUpdate, GeneratorFieldUpdate, TableDetail, DictionaryTypeOption, MenuChoice} from '../../generated/api';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {generatorMenuLabels} from './options';

const optionLabels:Record<string,string>={crud:'单表',tree:'树表',sub:'主子表',input:'文本框',textarea:'文本域',select:'下拉框',radio:'单选框',checkbox:'复选框',datetime:'日期控件',imageUpload:'图片上传',fileUpload:'文件上传',editor:'富文本',EQ:'等于',NE:'不等于',GT:'大于',GTE:'大于等于',LT:'小于',LTE:'小于等于',LIKE:'包含',BETWEEN:'范围','0':'ZIP下载','1':'自定义路径','eforge-react':'React / EForge','element-ui':'Vue2 / Element UI','element-plus':'Vue3 / Element Plus','element-plus-typescript':'Vue3 / Element Plus / TypeScript'};
const webTypes=['eforge-react','element-ui','element-plus','element-plus-typescript'] as const;
const javaTypes=['Long','String','Integer','Double','BigDecimal','Date','Boolean'] as const;
const controls=['input','textarea','select','radio','checkbox','datetime','imageUpload','fileUpload','editor'] as const;
const queries=['EQ','NE','GT','GTE','LT','LTE','LIKE','BETWEEN'] as const;
type ColumnDraft=Omit<GeneratorFieldUpdate,'javaType'|'controlType'|'queryType'> & {javaType:string;controlType:string;queryType:string};
type Draft=Omit<GeneratorConfigurationUpdate,'columns'|'webType'> & {columns:ColumnDraft[];webType:string};
class LocalValidationError extends Error {}
function selected<T extends string>(value:string, choices:readonly T[]):T {
  const found=choices.find(choice=>choice===value);
  if(!found) throw new LocalValidationError('请选择有效的模板、字段类型、显示控件和查询方式。');
  return found;
}
function draftOf(detail:TableDetail):Draft {
  const config=detail.configuration;
  return {name:detail.table.name ?? '',comment:detail.table.comment ?? '',className:detail.table.className ?? '',
    category: detail.table.category === 'tree' ? 'tree' : detail.table.category === 'sub' ? 'sub' : 'crud',
    webType:detail.table.webType ?? 'element-ui',packageName:config.packageName ?? '',moduleName:config.moduleName ?? '',
    businessName:config.businessName ?? '',functionName:config.functionName ?? '',author:config.author ?? '',
    formColumns:config.formColumns ?? 1,outputType:config.outputType ?? '0',outputPath:config.outputPath ?? '/',
    subTableName:config.subTableName ?? '',subTableForeignKey:config.subTableForeignKey ?? '',remark:config.remark ?? '',
    options:{parentMenuId:config.options.parentMenuId ?? '0',generateDetail:config.options.generateDetail ?? false,
      treeCode:config.options.treeCode ?? '',treeName:config.options.treeName ?? '',treeParentCode:config.options.treeParentCode ?? ''},
    columns:detail.columns.map(field=>({id:field.id,comment:field.comment ?? '',javaType:field.javaType ?? '',
      javaField:field.javaField ?? '',required:field.required ?? false,insertable:field.insertable ?? false,
      editable:field.editable ?? false,listed:field.listed ?? false,queryable:field.queryable ?? false,
      queryType:field.queryType ?? 'EQ',controlType:field.controlType ?? 'input',dictionaryType:field.dictionaryType ?? '',order:field.order ?? 0}))};
}
function ChoiceSelect({label,value,values,onChange,disabled}:{label:string;value:string;values:readonly string[];onChange:(value:string)=>void;disabled:boolean}) {
  return <label>{label}<Select aria-label={label} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>
    {!values.includes(value)?<option value={value}>{value || '请选择'}</option>:null}
    {values.map(choice=><option key={choice} value={choice}>{optionLabels[choice] ?? choice}</option>)}</Select></label>;
}
export function GeneratorEditor({detail,onCancel,onSaved}:{detail:TableDetail;onCancel:()=>void;onSaved:()=>void}) {
  const api=useApi(),[form,setForm]=useState(()=>draftOf(detail)),[tab,setTab]=useState('basic');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
  const [dirty,setDirty]=useState(false),dragging=useRef<string|null>(null);
  const [menus,setMenus]=useState<MenuChoice[]>([]),[dictionaries,setDictionaries]=useState<DictionaryTypeOption[]>([]);
  const [menuError,setMenuError]=useState(''),[dictionaryError,setDictionaryError]=useState(''),[optionLoading,setOptionLoading]=useState(true),[optionVersion,setOptionVersion]=useState(0),[menuSearch,setMenuSearch]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setOptionLoading(true);setMenuError('');setDictionaryError('');
    void Promise.allSettled([api.getGeneratorMenuOptions(controller.signal),api.getDictionaryOptions(controller.signal)]).then(([menuResult,dictionaryResult])=>{
      if(controller.signal.aborted)return;
      if(menuResult.status==='fulfilled'){try{generatorMenuLabels(menuResult.value);setMenus(menuResult.value);}catch{setMenuError('菜单层级无效，请刷新选项。');}}
      else setMenuError(errorMessage(menuResult.reason));
      if(dictionaryResult.status==='fulfilled')setDictionaries(dictionaryResult.value);else setDictionaryError(errorMessage(dictionaryResult.reason));
      setOptionLoading(false);
    });return()=>controller.abort();
  },[api,optionVersion]);
  const menuOptions=generatorMenuLabels(menus).filter(menu=>!menuSearch||menu.label.includes(menuSearch));
  function change(next:Draft){setForm(next);setDirty(true);setError('');}
  function cancel(){if(dirty) setDiscard(true);else onCancel();}
  async function save(event:FormEvent) {
    event.preventDefault();if(busy)return;setError('');
    try {
      const body:GeneratorConfigurationUpdate={...form,webType:selected(form.webType,webTypes),
        columns:form.columns.map(field=>({...field,javaType:selected(field.javaType,javaTypes),controlType:selected(field.controlType,controls),queryType:selected(field.queryType,queries)}))};
      if([body.name,body.comment,body.className,body.packageName,body.moduleName,body.businessName,body.functionName,body.author].some(value=>!value.trim()))
        throw new LocalValidationError('请填写表名称、描述、类名、包名、模块、业务、功能名称和作者。');
      setBusy(true);await api.updateGeneratorTable(detail.table.id,body);onSaved();
    }catch(cause){setError(cause instanceof LocalValidationError?cause.message:errorMessage(cause));}finally{setBusy(false);}
  }
  function fieldChange(index:number, next:Partial<ColumnDraft>) {
    change({...form,columns:form.columns.map((field,ordinal)=>ordinal===index?{...field,...next}:field)});
  }
    function drop(target:string){
    const source=dragging.current;dragging.current=null;if(!source||source===target||busy)return;
    const from=form.columns.findIndex(field=>field.id===source),to=form.columns.findIndex(field=>field.id===target);if(from<0||to<0)return;
    const fields=[...form.columns],picked=fields.splice(from,1)[0]!;fields.splice(to,0,picked);change({...form,columns:fields.map((field,order)=>({...field,order}))});
  }
  function move(index:number,offset:number) {
    const target=index+offset;if(target<0||target>=form.columns.length)return;
    const fields=[...form.columns];[fields[index],fields[target]]=[fields[target]!,fields[index]!];
    change({...form,columns:fields.map((field,order)=>({...field,order}))});
  }
  const basicLabels={name:'表名称',comment:'表描述',className:'实体类名称',author:'作者'} as const;
  const outputLabels={packageName:'生成包路径',moduleName:'生成模块名',businessName:'生成业务名',functionName:'生成功能名',outputPath:'自定义路径'} as const;
  return <ResourceDialog titleId="generator-editor-title" busy={busy} onCancel={cancel}>
    <h2 id="generator-editor-title">编辑生成配置</h2>
    {discard?<div role="alert"><p>有未保存的修改，是否放弃？</p><Button label="继续编辑" onClick={()=>setDiscard(false)}/><Button label="放弃修改" variant="secondary" onClick={onCancel}/></div>:null}
    <ListToolbar  role="tablist" aria-label="生成配置">
      {([['basic','基本信息'],['fields','字段信息'],['output','生成信息']] as const).map(([id,label])=><NativeButton type="button" role="tab" id={'generator-tab-'+id} aria-controls={'generator-panel-'+id} tabIndex={tab===id?0:-1} onKeyDown={event=>{const tabs=['basic','fields','output'];let position=tabs.indexOf(id);if(event.key==='ArrowRight')position=(position+1)%3;else if(event.key==='ArrowLeft')position=(position+2)%3;else if(event.key==='Home')position=0;else if(event.key==='End')position=2;else return;event.preventDefault();setTab(tabs[position]!);(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[position])?.focus();}} aria-selected={tab===id} key={id} disabled={busy} onClick={()=>setTab(id)}>{label}</NativeButton>)}
    </ListToolbar>
    <PageForm onSubmit={event=>{void save(event);}}>
      <div hidden={tab!=='basic'} role="tabpanel" id="generator-panel-basic" aria-labelledby="generator-tab-basic">
        <label>备注<TextareaControl aria-label="备注" value={form.remark ?? ''} disabled={busy} onChange={event=>change({...form,remark:event.target.value})}/></label>
        {Object.entries(basicLabels).map(([key,label])=><Input key={key} label={label} value={form[key as keyof typeof basicLabels] ?? ''} isDisabled={busy} onChange={value=>change({...form,[key]:value})}/>)}
      </div>
      <div hidden={tab!=='fields'} role="tabpanel" id="generator-panel-fields" aria-labelledby="generator-tab-fields" className="post-table">
        {dictionaryError?<div role="alert">字典选项：{dictionaryError}<Button label="重试字典选项" isDisabled={busy||optionLoading} onClick={()=>setOptionVersion(value=>value+1)}/></div>:null}
        <Table><thead><tr><th>数据库字段</th><th>字段描述</th><th>Java类型</th><th>Java属性</th><th>配置</th><th>查询</th><th>控件</th><th>字典</th><th>排序</th></tr></thead><tbody>
          {form.columns.map((field,index)=>{
            const physical=detail.columns.find(column=>column.id===field.id);
            return <tr key={field.id} onDragOver={event=>{if(dragging.current&&!busy)event.preventDefault();}} onDrop={event=>{event.preventDefault();drop(field.id);}}><td>{physical?.name}<br/>{physical?.databaseType}{physical?.primaryKey?' · 主键':''}{physical?.autoIncrement?' · 自增':''}</td>
              <td><Input label={'字段描述 '+physical?.name} value={field.comment ?? ''} isDisabled={busy} onChange={comment=>fieldChange(index,{comment})}/></td>
              <td><ChoiceSelect label={'Java类型 '+physical?.name} value={field.javaType} values={javaTypes} disabled={busy} onChange={javaType=>fieldChange(index,{javaType})}/></td>
              <td><Input label={'Java属性 '+physical?.name} value={field.javaField} isDisabled={busy} onChange={javaField=>fieldChange(index,{javaField})}/></td>
              <td>{([['required','必填'],['insertable','插入'],['editable','编辑'],['listed','列表'],['queryable','查询']] as const).map(([key,label])=><label key={key}><NativeInput type="checkbox" disabled={busy} aria-label={label+' '+physical?.name} checked={field[key]} onChange={event=>fieldChange(index,{[key]:event.target.checked})}/>{label}</label>)}</td>
              <td><ChoiceSelect label={'查询方式 '+physical?.name} value={field.queryType} values={queries} disabled={busy} onChange={queryType=>fieldChange(index,{queryType})}/></td>
              <td><ChoiceSelect label={'显示控件 '+physical?.name} value={field.controlType} values={controls} disabled={busy} onChange={controlType=>fieldChange(index,{controlType})}/></td>
              <td><label>字典类型<Select aria-label={'字典类型 '+physical?.name} value={field.dictionaryType ?? ''} disabled={busy||optionLoading} onChange={event=>fieldChange(index,{dictionaryType:event.target.value})}>
                <option value="">无字典</option>{field.dictionaryType&&!dictionaries.some(item=>item.code===field.dictionaryType)?<option value={field.dictionaryType}>{field.dictionaryType}（当前配置）</option>:null}
                {dictionaries.map(item=><option key={item.id} value={item.code}>{item.name} · {item.code}{item.status==='1'?'（停用）':''}</option>)}</Select></label></td>
              <td><NativeButton type="button" draggable={!busy} disabled={busy} aria-label={'拖动排序 '+physical?.name} onDragStart={event=>{dragging.current=field.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',field.id);}} onDragEnd={()=>{dragging.current=null;}}>拖动排序</NativeButton><NativeInput type="number" aria-label={'排序 '+physical?.name} min={0} max={1000000} required value={field.order} disabled={busy} onChange={event=>fieldChange(index,{order:Number(event.target.value)})}/>
                <Button label={'上移 '+physical?.name} isDisabled={busy||index===0} onClick={()=>move(index,-1)}/><Button label={'下移 '+physical?.name} isDisabled={busy||index===form.columns.length-1} onClick={()=>move(index,1)}/></td>
            </tr>;
          })}
        </tbody></Table>
      </div>
      <div hidden={tab!=='output'} role="tabpanel" id="generator-panel-output" aria-labelledby="generator-tab-output">
        <ChoiceSelect label="生成模板" value={form.category} values={['crud','tree','sub']} disabled={busy} onChange={value=>change({...form,category:selected(value,['crud','tree','sub'] as const),subTableName:value==='sub'?form.subTableName:'',subTableForeignKey:value==='sub'?form.subTableForeignKey:''})}/>
        <ChoiceSelect label="前端类型" value={form.webType} values={webTypes} disabled={busy} onChange={webType=>change({...form,webType})}/>
        {Object.entries(outputLabels).map(([key,label])=><Input key={key} label={label} value={form[key as keyof typeof outputLabels] ?? ''} isDisabled={busy} onChange={value=>change({...form,[key]:value})}/>)}
        <Button label="恢复默认生成路径" isDisabled={busy} onClick={()=>change({...form,outputPath:'/'})}/>
        <label>表单列数<Select aria-label="表单列数" value={form.formColumns} disabled={busy} onChange={event=>change({...form,formColumns:Number(event.target.value)})}>{[1,2,3].map(value=><option key={value}>{value}</option>)}</Select></label>
        <ChoiceSelect label="生成方式" value={form.outputType} values={['0','1']} disabled={busy} onChange={outputType=>change({...form,outputType})}/>
        <Input label="查找上级菜单" value={menuSearch} isDisabled={busy} onChange={setMenuSearch}/>
        <label>上级菜单<Select aria-label="上级菜单" value={form.options.parentMenuId ?? '0'} disabled={busy||optionLoading} onChange={event=>change({...form,options:{...form.options,parentMenuId:event.target.value}})}>
          <option value="0">主目录</option>{form.options.parentMenuId&&form.options.parentMenuId!=='0'&&!menuOptions.some(menu=>menu.id===form.options.parentMenuId)?<option value={form.options.parentMenuId}>{detail.configuration.options.parentMenuName ?? form.options.parentMenuId}（当前配置）</option>:null}
          {menuOptions.map(menu=><option key={menu.id} value={menu.id} disabled={!['M','C'].includes(menu.kind)}>{menu.label}{menu.kind==='F'?'（功能节点）':''}</option>)}</Select></label>
        {menuError?<div role="alert">菜单选项：{menuError}<Button label="重试菜单选项" isDisabled={busy||optionLoading} onClick={()=>setOptionVersion(value=>value+1)}/></div>:null}
        <label><NativeInput type="checkbox" disabled={busy} checked={form.options.generateDetail} onChange={event=>change({...form,options:{...form.options,generateDetail:event.target.checked}})}/>生成详情页面</label>
        {form.category==='tree'?(['treeCode','treeParentCode','treeName'] as const).map((key,index)=><ChoiceSelect key={key} label={['树编码字段','树父编码字段','树名称字段'][index]!} value={form.options[key] ?? ''} values={['',...detail.columns.map(field=>field.name ?? '')]} disabled={busy} onChange={value=>change({...form,options:{...form.options,[key]:value}})}/>):null}
        {form.category==='sub'?<>
          <ChoiceSelect label="关联子表" value={form.subTableName ?? ''} values={['',...detail.tables.filter(table=>table.id!==detail.table.id).map(table=>table.name ?? '')]} disabled={busy} onChange={subTableName=>change({...form,subTableName,subTableForeignKey:''})}/>
          <ChoiceSelect label="子表外键" value={form.subTableForeignKey ?? ''} values={['',...(detail.tables.find(table=>table.name===form.subTableName)?.columns.map(field=>field.name ?? '') ?? [])]} disabled={busy} onChange={subTableForeignKey=>change({...form,subTableForeignKey})}/>
        </>:null}
      </div>
      {error?<p role="alert">{error}</p>:null}
      <div className="post-dialog-actions"><Button label={busy?'正在保存…':'保存配置'} type="submit" isDisabled={busy}/><Button label="取消" variant="secondary" isDisabled={busy} onClick={cancel}/></div>
    </PageForm>
  </ResourceDialog>;
}
