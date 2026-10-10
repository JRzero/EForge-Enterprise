import {expect,it,vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const key='eforge.enterprise.session.v1';
const snapshot={user:{id:'7',username:'reader',displayName:'Reader'},roles:[],permissions:[],navigation:[]};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
it('keeps workflow versions exact and uses authenticated generated maintenance endpoints',async()=>{
  const storage=createMemoryStorage({[key]:JSON.stringify({accessToken:'test-token'})});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockImplementation(async()=>json({id:'package',revision:'9007199254740993'}));
  const runtime=createSessionRuntime(storage,fetcher);await runtime.restore();
  const content={name:'审批',businessType:'leave',source:{bpmnXml:'<workflow/>',scenarios:[]}};
  await runtime.api.updateWorkflowPackage('package',{content,expectedRevision:'9007199254740993'});
  await runtime.api.validateWorkflowPackage('package','9007199254740993');
  await runtime.api.publishWorkflowPackage('package','9007199254740993');
  await runtime.api.activateWorkflowRelease({releaseId:'release',expectedRevision:'9007199254740993'});
  expect(fetcher.mock.calls.slice(1).map(([path])=>String(path))).toEqual([
    '/api/v1/workflow/packages/package','/api/v1/workflow/packages/package/validation',
    '/api/v1/workflow/packages/package/releases','/api/v1/workflow/activations/leave']);
  for(const [,init]of fetcher.mock.calls.slice(1)){
    expect(JSON.parse(String(init?.body)).expectedRevision).toBe('9007199254740993');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(init?.credentials).toBe('omit');
  }
});
it('forwards cancellation for list reads and does not treat stale publication as success',async()=>{
  const storage=createMemoryStorage({[key]:JSON.stringify({accessToken:'test-token'})});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({items:[],page:2,pageSize:10,total:0}))
    .mockResolvedValueOnce(json({code:'WORKFLOW_RELEASE_CONFLICT'},409));
  const runtime=createSessionRuntime(storage,fetcher);await runtime.restore();const abort=new AbortController();
  await runtime.api.listWorkflowPackages({page:2,pageSize:10},abort.signal);
  expect(String(fetcher.mock.calls[1]![0])).toContain('page=2');abort.abort();expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
  await expect(runtime.api.publishWorkflowPackage('package','1')).rejects.toMatchObject({status:409,code:'WORKFLOW_RELEASE_CONFLICT'});
  expect(runtime.getSnapshot().phase).toBe('authenticated');
});
