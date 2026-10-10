import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execute} from './workflow-agent.mjs';
const id='00000000-0000-0000-0000-000000000001';
const env={EFORGE_WORKFLOW_URL:'http://127.0.0.1:18081',EFORGE_WORKFLOW_TOKEN:'owned-fixture-token'};
test('exact versions and explicit activation use canonical API without implicit writes',async()=>{
  const requests=[];const fetchImpl=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({revision:'9007199254740993'}),{status:200});};
  const result=await execute(['publish','--id',id,'--revision','9007199254740993'],{env,fetchImpl});
  assert.equal(result.ok,true);assert.equal(requests.length,1);assert.equal(requests[0].url,env.EFORGE_WORKFLOW_URL+`/api/v1/workflow/packages/${id}/releases`);
  assert.deepEqual(JSON.parse(requests[0].options.body),{expectedRevision:'9007199254740993'});assert.equal(requests[0].options.redirect,'error');
  await execute(['activate','--id',id,'--revision','0'],{env,fetchImpl});assert.deepEqual(JSON.parse(requests[1].options.body),{releaseId:id,expectedRevision:'0'});
});
test('auth, unsafe destinations, duplicate options and invalid revisions never send requests',async()=>{
  const fetchImpl=()=>assert.fail('must not send');
  for(const args of [['publish','--id',id],['publish','--id',id,'--revision','9223372036854775808'],['list','--page','1','--page','2'],['status','--token','secret']])
    assert.equal((await execute(args,{env,fetchImpl})).ok,false);
  for(const url of ['http://example.com','https://user:password@example.com','https://example.com/?secret=1','file:///tmp/test'])
    assert.equal((await execute(['status'],{env:{...env,EFORGE_WORKFLOW_URL:url},fetchImpl})).ok,false);
  assert.equal((await execute(['status'],{env:{EFORGE_WORKFLOW_URL:env.EFORGE_WORKFLOW_URL},fetchImpl})).ok,false);
});
test('conflict and network errors are structured, sanitized and never automatically retried',async()=>{
  let calls=0;const response=await execute(['activate','--id',id,'--revision','1'],{env,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({code:'WORKFLOW_RELEASE_CONFLICT',detail:'jdbc secret'}),{status:409});}});
  assert.deepEqual(response,{ok:false,status:409,code:'WORKFLOW_RELEASE_CONFLICT'});assert.equal(calls,1);
  const failed=await execute(['status'],{env,fetchImpl:async()=>{throw new Error('token=owned-fixture-token');}});
  assert.equal(failed.code,'NETWORK_FAILURE');assert.equal(JSON.stringify(failed).includes(env.EFORGE_WORKFLOW_TOKEN),false);
});
test('update consumes an explicit local JSON file and preserves source as data',async()=>{
  const content={name:'审批',businessType:'leave',source:{bpmnXml:'<process/>',scenarios:[]}};
  let body;const result=await execute(['update','--id',id,'--revision','2','--file','draft.json'],{env,
    readFile:async(path)=>{assert.equal(path,'draft.json');return JSON.stringify(content);},
    fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return new Response('{}');}});
  assert.equal(result.ok,true);assert.deepEqual(body,{expectedRevision:'2',content});
});
test('actual HTTP redirect cannot forward the bearer token to another path',async()=>{
  const paths=[];const server=createServer((request,response)=>{paths.push(request.url);response.writeHead(307,{Location:'/unexpected'});response.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const result=await execute(['status'],{env:{...env,EFORGE_WORKFLOW_URL:`http://127.0.0.1:${server.address().port}`}});
    assert.equal(result.code,'NETWORK_FAILURE');assert.deepEqual(paths,['/api/v1/workflow/status']);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
