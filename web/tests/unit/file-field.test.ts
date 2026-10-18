// @vitest-environment jsdom
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {FileField} from '../../ui/FileField';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

for(const mode of ['cancel','unmount','readonly'])it(`file field ignores late completion after ${mode} and releases its busy owner once`,async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const changed=vi.fn(),busy=vi.fn();let resolve!:(path:string)=>void,signal:AbortSignal|undefined;
  const pending=new Promise<string>(done=>{resolve=done;});
  const props={label:'文件',value:['prior.txt'],onChange:changed,maxFiles:5,validate:()=>undefined,renderFile:(path:string)=>path,onBusyChange:busy,upload:(_file:File,received:AbortSignal)=>{signal=received;return pending;}};
  await act(async()=>root.render(createElement(FileField,props)));
  const input=host.querySelector('input')!;Object.defineProperty(input,'files',{value:[new File(['test'],'new.txt')],configurable:true});
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
  expect(busy.mock.calls).toEqual([[true]]);
  if(mode==='cancel')await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='取消上传')!.click());
  if(mode==='unmount')await act(async()=>root.unmount());
  if(mode==='readonly')await act(async()=>root.render(createElement(FileField,{...props,readOnly:true})));
  await act(async()=>resolve('late.txt'));
  expect(changed).not.toHaveBeenCalled();expect(signal?.aborted).toBe(true);expect(busy.mock.calls).toEqual([[true],[false]]);
  if(mode!=='unmount')await act(async()=>root.unmount());host.remove();
});
