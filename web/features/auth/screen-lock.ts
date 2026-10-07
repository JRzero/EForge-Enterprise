import type {UserSummary} from '../../generated/api';
export type ScreenLock = {ownerId:string; username:string; returnHref:string};
const key='eforge.enterprise.screen-lock.v1';
export function safeLockReturn(value:unknown):string {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || value.length>2048 || (value.includes('\\') || Array.from(value).some(character=>character.charCodeAt(0)<32 || character.charCodeAt(0)===127)))return '/dashboard';
  const path=new URL(value,'http://eforge.local').pathname;
  return ['/lock','/login','/register'].includes(path)?'/dashboard':value;
}
export function readScreenLock():ScreenLock|null {
  try {const value:unknown=JSON.parse(sessionStorage.getItem(key)??'null');
    if(!value || typeof value!=='object' || !('ownerId' in value) || !('username' in value) || !('returnHref' in value) || typeof value.ownerId!=='string' || typeof value.username!=='string')return null;
    return {ownerId:value.ownerId,username:value.username,returnHref:safeLockReturn(value.returnHref)};
  }catch{return null;}
}
export function saveScreenLock(lock:ScreenLock|null){try{if(lock)sessionStorage.setItem(key,JSON.stringify(lock));else sessionStorage.removeItem(key);}catch{/* in-memory state still locks this visit */}}
export function lockBelongsTo(lock:ScreenLock|null,user:UserSummary):lock is ScreenLock{return !!lock && lock.ownerId===user.id && lock.username===user.username;}
