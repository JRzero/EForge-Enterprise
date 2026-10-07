import {describe,expect,it} from 'vitest';
import {generatedUploadIssue} from '../../features/generator/uploadPolicy';
const png={name:'合法`图片.png',size:1024,type:'image/png'};
describe('original generated upload list boundaries',()=>{
  it('retains quoted Unicode and extensionless actual PNG files',()=>{expect(generatedUploadIssue([png,{...png,name:'无扩展图片'}],0,true)).toBeUndefined();});
  it('rejects comma filenames before they can split persisted CSV paths',()=>{expect(generatedUploadIssue([{...png,name:'合法,图片.png'}],0,true)).toContain('逗号');});
  it('retains all five entries and rejects a sixth',()=>{expect(generatedUploadIssue([png],4,true)).toBeUndefined();expect(generatedUploadIssue([png],5,true)).toContain('五个');});
  it('uses the original strict five MiB boundary',()=>{expect(generatedUploadIssue([{...png,size:5*1024*1024-1}],0,true)).toBeUndefined();expect(generatedUploadIssue([{...png,size:5*1024*1024}],0,true)).toContain('小于');});
  it('retains all original document types and refuses executable files',()=>{for(const extension of ['doc','docx','xls','xlsx','ppt','pptx','txt','pdf'])expect(generatedUploadIssue([{name:'文件.'+extension,size:1,type:'application/octet-stream'}],0,false)).toBeUndefined();expect(generatedUploadIssue([{name:'文件.exe',size:1,type:'application/octet-stream'}],0,false)).toContain('格式');});
});
