import {expect,it,vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
import {GeneratorCreationError} from '../../integration/generator-errors';
const bootstrap={user:{id:'2',username:'writer',displayName:'Writer'},roles:[],permissions:[],navigation:[]};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const storage=()=>createMemoryStorage({'eforge.enterprise.session.v1':JSON.stringify({accessToken:'token'})});
it('retains physical partial creation outcomes and never automatically repeats DDL',async()=>{
  const creation={physical:[{name:'中文表',state:'CREATED'},{name:'第二表',state:'FAILED'},{name:'第三表',state:'UNATTEMPTED'}],importState:'UNATTEMPTED',imported:[]};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({code:'GENERATOR_CREATE_PARTIAL',creation,detail:'private SQL'},409));
  const runtime=createSessionRuntime(storage(),fetcher);await runtime.restore();const cause=await runtime.api.createGeneratorTables({sql:'CREATE TABLE `中文表` (`id` bigint)',template:'eforge-react'}).catch(cause=>cause);
  expect(cause).toBeInstanceOf(GeneratorCreationError);expect(cause.creation).toEqual(creation);expect(cause.message).not.toContain('private');expect(fetcher).toHaveBeenCalledTimes(2);
  const [url,init]=fetcher.mock.calls[1]!;expect(url).toBe('/api/v1/tool/generator/creations');expect(init?.method).toBe('POST');expect(init?.credentials).toBe('omit');expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
});
it('lost creation acknowledgement stays unconfirmed without automatic resend',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockRejectedValueOnce(new TypeError('private network'));
  const runtime=createSessionRuntime(storage(),fetcher);await runtime.restore();await expect(runtime.api.createGeneratorTables({sql:'CREATE TABLE x (id bigint)',template:'eforge-react'})).rejects.toMatchObject({status:0,code:'GENERATOR_CREATE_UNCONFIRMED'});expect(fetcher).toHaveBeenCalledTimes(2);
});
