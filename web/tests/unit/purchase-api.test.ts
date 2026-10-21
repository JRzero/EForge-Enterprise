import {expect,it,vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const bootstrap={user:{id:'2',username:'buyer',displayName:'采购员'},roles:[],permissions:[],navigation:[]};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function setup(fetcher:ReturnType<typeof vi.fn<typeof fetch>>){
  const runtime=createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1':JSON.stringify({accessToken:'token'})}),fetcher);
  await runtime.restore();return runtime;
}
it('preserves exact purchase values, command identity, private attachment bytes and multipart filename',async()=>{
  const purchase={id:'purchase-id',revision:'9007199254740993',total:'999999999999.99'};
  const bytes=new Uint8Array([0,255,128,37,80,68,70]);
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json(purchase,201))
    .mockResolvedValueOnce(json(purchase)).mockResolvedValueOnce(json(purchase)).mockResolvedValueOnce(new Response(bytes));
  const {api}=await setup(fetcher);
  const content={title:'设备',reason:'采购',approverId:'9007199254740995',items:[{id:'line-id',name:'电脑',unit:'台',quantity:'3.001',unitPrice:'99.99'}]};
  expect(await api.createPurchaseDraft({commandId:'same-command',content})).toEqual(purchase);
  const command={commandId:'submit-command',expectedRevision:purchase.revision,comment:'确认'};
  await api.submitPurchase(purchase.id,command);
  const file=new File([bytes],'报价.pdf',{type:'application/pdf'});await api.uploadPurchaseAttachment(purchase.id,'upload-command',purchase.revision,file);
  const abort=new AbortController(),blob=await api.downloadPurchaseAttachment(purchase.id,'file-id',abort.signal);
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({commandId:'same-command',content});
  expect(JSON.parse(String(fetcher.mock.calls[2]![1]?.body))).toEqual(command);
  const multipart=fetcher.mock.calls[3]![1]?.body;expect(multipart).toBeInstanceOf(FormData);expect((multipart as FormData).get('file')).toMatchObject({name:'报价.pdf'});
  expect(String(fetcher.mock.calls[3]![0])).toContain('expectedRevision=9007199254740993');
  for(const [url,init] of fetcher.mock.calls){expect(String(url)).not.toContain('token');expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');expect(init?.credentials).toBe('omit');expect(init?.cache).toBe('no-store');}
  abort.abort();expect(fetcher.mock.calls[4]![1]?.signal?.aborted).toBe(true);
});
it('keeps purchase activation separate from leave and expires a session only on 401',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({revision:'0'}))
    .mockResolvedValueOnce(json({revision:'1'})).mockResolvedValueOnce(json({code:'PURCHASE_CONFLICT'},409))
    .mockResolvedValueOnce(json({code:'AUTHENTICATION_REQUIRED'},401));
  const runtime=await setup(fetcher);
  await runtime.api.getWorkflowActivation(undefined,'purchase');await runtime.api.activateWorkflowRelease({releaseId:'release',expectedRevision:'0'},'purchase');
  expect(String(fetcher.mock.calls[1]![0])).toContain('purchase');expect(String(fetcher.mock.calls[2]![0])).toContain('purchase');
  await expect(runtime.api.submitPurchase('id',{commandId:'c',expectedRevision:'0',comment:''})).rejects.toMatchObject({status:409});
  expect(runtime.getSnapshot().phase).toBe('authenticated');await expect(runtime.api.getPurchase('id')).rejects.toMatchObject({status:401});expect(runtime.getSnapshot().phase).toBe('signed-out');
});
