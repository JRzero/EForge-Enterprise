import {useMemo} from 'react';
const words=new Set('abstract as async await boolean break case catch class const continue create database default delete do double else enum export extends false final finally float for from function if implements import in insert int interface into join let long new null package private protected public record return select static string switch table this throw throws true try type typeof update values var void where while'.split(' '));
type Token={text:string;kind:'plain'|'string'|'comment'|'keyword'|'number'};
/** Linear scanning; source always stays React text, never HTML. */
function tokenize(source:string):Token[]{
  if(source.length>262144)return [{text:source,kind:'plain'}];
  const tokens:Token[]=[];let index=0,plain=0;
  function emit(end:number,kind:Token['kind']){if(index>plain)tokens.push({text:source.slice(plain,index),kind:'plain'});tokens.push({text:source.slice(index,end),kind});index=end;plain=end;}
  while(index<source.length){
    if(source.startsWith('//',index)||source.startsWith('--',index)){let end=index+2;while(end<source.length&&source[end]!=='\n')end++;emit(end,'comment');continue;}
    if(source.startsWith('/*',index)||source.startsWith('<!--',index)){const close=source.startsWith('/*',index)?'*/':'-->',found=source.indexOf(close,index+2);emit(found<0?source.length:found+close.length,'comment');continue;}
    const character=source[index]!;
    if(character==='"'||character==="'"||character==='`'){let end=index+1;while(end<source.length){if(source[end]==='\\'){end=Math.min(end+2,source.length);continue;}if(source[end++]===character)break;}emit(end,'string');continue;}
    if(/[A-Za-z_$]/.test(character)){let end=index+1;while(end<source.length&&/[A-Za-z0-9_$]/.test(source[end]!))end++;if(words.has(source.slice(index,end).toLowerCase()))emit(end,'keyword');else index=end;continue;}
    if(/[0-9]/.test(character)){let end=index+1;while(end<source.length&&/[0-9.]/.test(source[end]!))end++;emit(end,'number');continue;}
    index++;
  }
  if(plain<source.length)tokens.push({text:source.slice(plain),kind:'plain'});return tokens;
}
export function GeneratorCodePreview({source}:{source:string}){
  const tokens=useMemo(()=>tokenize(source),[source]);
  return <pre tabIndex={0} aria-label="生成代码预览"><code>{tokens.map((token,index)=>token.kind==='plain'?token.text:<span key={index} className={'generator-code-'+token.kind}>{token.text}</span>)}</code></pre>;
}
