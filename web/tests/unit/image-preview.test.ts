import {describe,expect,it} from 'vitest';
import {imagePreviewUrls} from '../../app/components/ImagePreview';
describe('original image sources remain inert image URLs',()=>{
  it('preserves backend paths, quoted Unicode filenames and original HTTP/HTTPS galleries',()=>{
    expect(imagePreviewUrls('/profile/upload/中文`图片.png,https://images.example.test/相片.png,http://images.example.test/a.jpg','https://app.example.test')).toEqual(['https://app.example.test/profile/upload/%E4%B8%AD%E6%96%87%60%E5%9B%BE%E7%89%87.png','https://images.example.test/%E7%9B%B8%E7%89%87.png','http://images.example.test/a.jpg']);
  });
  it('rejects executable/data schemes, credentials and control-character protocol smuggling',()=>{
    expect(imagePreviewUrls('javascript:alert(1),data:image/svg+xml;base64PHNjcmlwdD4=,https://user:secret@images.example.test/a.png,java\nscript:alert(1)','https://app.example.test')).toEqual([]);
  });
  it('does not drop other safe gallery entries when one source is invalid',()=>{
    expect(imagePreviewUrls('/first.png,javascript:alert(1),/second.png','https://app.example.test')).toEqual(['https://app.example.test/first.png','https://app.example.test/second.png']);
  });
});
