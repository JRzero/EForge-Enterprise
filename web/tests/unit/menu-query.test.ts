import {describe,expect,it} from 'vitest';
import {menuQueryHref} from '../../integration/menu-query';
describe('registered menu default query values',()=>{
  it('preserves exact quoted IDs, Unicode, prototype keys, repeated values, null and zero/false',()=>{
    const href=menuQueryHref('/role','{"id":"9007199254740999","__proto__":"文字 &?/#","list":["a",null,"b"],"bare":null,"empty":"","zero":0,"flag":false}');
    const url=new URL(href,'https://app.example');
    expect(url.pathname).toBe('/role');expect(url.hash).toBe('');
    expect(url.searchParams.get('id')).toBe('9007199254740999');expect(url.searchParams.get('__proto__')).toBe('文字 &?/#');
    expect(url.searchParams.getAll('list')).toEqual(['a','','b']);expect(href).toContain('&bare&empty=');
    expect(url.searchParams.get('zero')).toBe('0');expect(url.searchParams.get('flag')).toBe('false');
    expect(Object.prototype).not.toHaveProperty('文字 &?/#');
  });
  it('keeps original object/nested-array URL coercion without invoking payload toString properties',()=>{
    const href=menuQueryHref('/role','{"value":{"toString":"hostile"},"list":[[1,null,2],"x"],"none":[]}');
    const query=new URL(href,'https://app.example').searchParams;
    expect(query.get('value')).toBe('[object Object]');expect(query.getAll('list')).toEqual(['1,,2','x']);expect(query.has('none')).toBe(false);
  });
  it('leaves blank queries unchanged and refuses malformed or primitive roots',()=>{
    expect(menuQueryHref('/role','')).toBe('/role');expect(menuQueryHref('/role','  ')).toBe('/role');
    for(const value of ['{','null','false','"text"'])expect(()=>menuQueryHref('/role',value)).toThrow();
  });
});