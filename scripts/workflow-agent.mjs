#!/usr/bin/env node
import {readFile as readLocalFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const commands={status:[],list:['page','page-size'],read:['id'],create:['file'],update:['id','revision','file'],
  validate:['id','revision'],publish:['id','revision'],releases:['id','page','page-size'],release:['id'],activation:[],activate:['id','revision'],diff:['id','baseline','target'],
  jobs:['id','page','page-size'],retry:['job','leave','command']};
const failure=(code,status)=>({ok:false,...(status===undefined?{}:{status}),code});
function requestPlan(args,env){
  const [command,...flags]=args,allowed=commands[command];if(!allowed)throw Error('INVALID_ARGUMENTS');
  const options={};for(let index=0;index<flags.length;index+=2){
    const key=flags[index].startsWith('--')?flags[index].slice(2):'';
    if(!allowed.includes(key)||Object.hasOwn(options,key)||!flags[index+1]||flags[index+1].startsWith('--'))throw Error('INVALID_ARGUMENTS');
    options[key]=flags[index+1];
  }
  for(const key of allowed.filter(key=>!['page','page-size','target'].includes(key)))if(!options[key])throw Error('INVALID_ARGUMENTS');
  if(options.id&&!uuid.test(options.id))throw Error('INVALID_ARGUMENTS');
  if(options.job&&!/^[A-Za-z0-9_-]{1,64}$/.test(options.job)||options.leave&&!uuid.test(options.leave)||options.command&&!uuid.test(options.command))throw Error('INVALID_ARGUMENTS');
  if(options.baseline&&!uuid.test(options.baseline)||options.target&&!uuid.test(options.target))throw Error('INVALID_ARGUMENTS');
  if(options.revision!==undefined&&(!/^(0|[1-9][0-9]{0,18})$/.test(options.revision)||BigInt(options.revision)>9223372036854775807n||(command!=='activate'&&options.revision==='0')))throw Error('INVALID_ARGUMENTS');
  if(options.page&&(!/^[1-9][0-9]*$/.test(options.page)||Number(options.page)>1000000))throw Error('INVALID_ARGUMENTS');
  if(options['page-size']&&(!/^[1-9][0-9]*$/.test(options['page-size'])||Number(options['page-size'])>100))throw Error('INVALID_ARGUMENTS');
  let base;try{base=new URL(env.EFORGE_WORKFLOW_URL);}catch{throw Error('INVALID_DESTINATION');}
  if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||
    !(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw Error('INVALID_DESTINATION');
  if(!env.EFORGE_WORKFLOW_TOKEN||/[\r\n]/.test(env.EFORGE_WORKFLOW_TOKEN))throw Error('AUTHENTICATION_REQUIRED');
  const root='/api/v1/workflow',query=new URLSearchParams({page:options.page??'1',pageSize:options['page-size']??'10'});
  const path={status:'/status',list:`/packages?${query}`,read:`/packages/${options.id}`,create:'/packages',update:`/packages/${options.id}`,
    validate:`/packages/${options.id}/validation`,publish:`/packages/${options.id}/releases`,releases:`/packages/${options.id}/releases?${query}`,
    release:`/releases/${options.id}`,activation:'/activations/leave',activate:'/activations/leave',jobs:`/releases/${options.id}/failed-jobs?${query}`,retry:`/jobs/${options.job}/retry`,
    diff:`/packages/${options.id}/comparison?${new URLSearchParams({baselineReleaseId:options.baseline??'',...(options.target?{targetReleaseId:options.target}:{})})}`}[command];
  const method=['create','validate','publish','retry'].includes(command)?'POST':['update','activate'].includes(command)?'PUT':'GET';
  return {command,options,url:base.origin+root+path,method};
}

/** One command, one canonical request. The server remains the permission and transaction authority. */
export async function execute(args,{env=process.env,fetchImpl=fetch,readFile=readLocalFile}={}){
  let plan,body;
  try{
    plan=requestPlan(args,env);
    if(plan.options.file){
      let content;try{const text=await readFile(plan.options.file,'utf8');if(Buffer.byteLength(text)>2097152)throw Error();content=JSON.parse(text);}catch{return failure('INVALID_PACKAGE_FILE');}
      if(!content||Array.isArray(content)||typeof content!=='object')return failure('INVALID_PACKAGE_FILE');
      body=plan.command==='update'?{expectedRevision:plan.options.revision,content}:content;
    }else if(plan.command==='activate')body={releaseId:plan.options.id,expectedRevision:plan.options.revision};
    else if(plan.command==='retry')body={commandId:plan.options.command,leaveId:plan.options.leave};
    else if(['validate','publish'].includes(plan.command))body={expectedRevision:plan.options.revision};
  }catch(error){return failure(['INVALID_ARGUMENTS','INVALID_DESTINATION','AUTHENTICATION_REQUIRED'].includes(error.message)?error.message:'INVALID_ARGUMENTS');}
  try{
    const response=await fetchImpl(plan.url,{method:plan.method,redirect:'error',signal:AbortSignal.timeout(60000),
      headers:{Authorization:`Bearer ${env.EFORGE_WORKFLOW_TOKEN}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    // Reject unexpectedly large responses before exposing content to the agent.
    const reader=response.body?.getReader();let bytes=0;const chunks=[];
    if(reader)for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2097152){await reader.cancel();return failure('INVALID_RESPONSE',response.status);}chunks.push(Buffer.from(value));}
    let data;try{data=bytes?JSON.parse(Buffer.concat(chunks).toString('utf8')):null;}catch{return failure('INVALID_RESPONSE',response.status);}
    if(!response.ok)return failure(typeof data?.code==='string'&&/^[A-Z][A-Z0-9_]{0,80}$/.test(data.code)?data.code:'REQUEST_FAILED',response.status);
    return {ok:true,status:response.status,data};
  }catch{return failure('NETWORK_FAILURE');}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await execute(process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.ok?0:1;
}
