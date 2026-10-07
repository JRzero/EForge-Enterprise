type UploadFile = Pick<File,'name'|'size'|'type'>;
const imageExtensions=['jpg','jpeg','png','gif','webp'];
const fileExtensions=['doc','docx','xls','xlsx','ppt','pptx','txt','pdf'];
export function generatedUploadIssue(files:readonly UploadFile[],existing:number,image:boolean):string|undefined {
  if(files.length+existing>5)return '最多上传五个文件。';
  for(const file of files) {
    if(file.name.includes(','))return '文件名不能包含英文逗号。';
    const extension=file.name.includes('.')?file.name.split('.').at(-1)?.toLowerCase():undefined;
    const allowed=extension?(image?imageExtensions:fileExtensions).includes(extension):image && ['image/png','image/jpeg','image/gif','image/webp'].includes(file.type);
    if(!allowed)return '文件格式不符合上传要求。';
    if(file.size>=5*1024*1024)return '每个文件必须小于 5 MB。';
  }
}
