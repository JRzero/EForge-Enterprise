import {safeResourceUrls} from './resourceUrls';
export function ResourceFileLinks({src}: {src:string}) {
  return <>{safeResourceUrls(src,window.location.origin).map((url,index)=>{
    const part=new URL(url).pathname.split('/').at(-1) ?? '';
    let name=part;try{name=decodeURIComponent(part);}catch{/* A malformed escape remains literal text. */}
    return <a key={`${index}-${url}`} href={url} target="_blank" rel="noopener noreferrer">{name}</a>;
  })}</>;
}
