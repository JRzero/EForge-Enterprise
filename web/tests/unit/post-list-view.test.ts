import {describe,it,expect} from 'vitest';
import {normalizePostListView} from '../../features/posts/postListView';

describe('post saved-view whitelist',()=>{
  it('retains permitted filters and visibility without record data, page, action columns or prototype keys',()=>{
    const input=JSON.parse('{"filters":{"code":"9007199254740993","name":"<标签>","status":"0","password":"secret","__proto__":"bad"},"columns":{"name":false,"actions":false,"__proto__":false},"rows":[1],"selected":[2],"page":9}');
    expect(normalizePostListView(input)).toEqual({filters:{code:'9007199254740993',name:'<标签>',status:'0'},columns:{name:false}});
    expect(Object.prototype).not.toHaveProperty('bad');
  });
  it('rejects malformed field types, unsupported statuses and oversized strings',()=>{
    for(const value of [null,[],{filters:[],columns:{}},{filters:{code:42},columns:{}},{filters:{status:'2'},columns:{}},{filters:{name:'a'.repeat(65)},columns:{}},{filters:{},columns:{id:'false'}}])expect(normalizePostListView(value)).toBeNull();
  });
});
