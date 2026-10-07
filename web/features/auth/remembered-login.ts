/** Explicit opt-in credentials, encrypted for 30 days in this browser origin. */
const databaseName='eforge-remembered-login';
const storeName='credential';
const optOutKey='eforge.remembered-login.opt-out';
const lifetime=30*24*60*60*1000;
type Saved={version:1;expiresAt:number;key:CryptoKey;iv:Uint8Array<ArrayBuffer>;ciphertext:ArrayBuffer};
export type RememberedLogin={username:string;password:string};
let operations:Promise<unknown>=Promise.resolve();
function ordered<T>(operation:()=>Promise<T>):Promise<T>{const result=operations.then(operation,operation);operations=result.catch(()=>{});return result;}
function open():Promise<IDBDatabase>{
  if(!globalThis.indexedDB || !globalThis.crypto?.subtle)return Promise.reject(new Error('Remembered login storage unavailable.'));
  return new Promise((resolve,reject)=>{let blocked=false;const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore(storeName);request.onerror=()=>reject(new Error('Remembered login storage unavailable.'));request.onblocked=()=>{blocked=true;reject(new Error('Remembered login storage unavailable.'));};request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};});
}
async function record<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const database=await open();
  try{return await new Promise<T>((resolve,reject)=>{const transaction=database.transaction(storeName,mode);let value:T;const request=operation(transaction.objectStore(storeName));request.onsuccess=()=>{value=request.result;};transaction.oncomplete=()=>resolve(value);transaction.onerror=transaction.onabort=()=>reject(new Error('Remembered login storage unavailable.'));});}finally{database.close();}
}
function additionalData(expiresAt:number){return new TextEncoder().encode(`eforge-remembered-login:v1:${expiresAt}`);}
export async function clearRememberedLogin(){
  // The non-secret opt-out marker is synchronous: reload cannot revive a pending deletion.
  localStorage.setItem(optOutKey,'1');return ordered(()=>record('readwrite',store=>store.clear()));
}
export async function saveRememberedLogin(login:RememberedLogin){
  localStorage.setItem(optOutKey,'0');return ordered(async()=>{
  if(!login.username || login.username.length>20 || !login.password || login.password.length>20)throw new Error('Invalid remembered login.');
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12)),expiresAt=Date.now()+lifetime;
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:additionalData(expiresAt)},key,new TextEncoder().encode(JSON.stringify(login)));
  const saved:Saved={version:1,key,iv,ciphertext,expiresAt};await record('readwrite',store=>store.put(saved,'current'));
});}
export function loadRememberedLogin(){return ordered(async():Promise<RememberedLogin|null>=>{
  const saved:unknown=await record('readonly',store=>store.get('current'));
  if(saved===undefined)return null;
  if(localStorage.getItem(optOutKey)!=='0'){await record('readwrite',store=>store.clear());return null;}
  try{
    const value=saved as Saved;
    if(value.version!==1 || !Number.isSafeInteger(value.expiresAt) || value.expiresAt<=Date.now() || value.expiresAt>Date.now()+lifetime || !(value.key instanceof CryptoKey) || value.key.extractable || value.key.algorithm.name!=='AES-GCM' || !(value.iv instanceof Uint8Array) || value.iv.byteLength!==12 || !(value.ciphertext instanceof ArrayBuffer) || value.ciphertext.byteLength>2048)throw new Error('Invalid saved login.');
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv,additionalData:additionalData(value.expiresAt)},value.key,value.ciphertext);
    const login:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext));
    if(!login || typeof login!=='object' || !('username' in login) || !('password' in login) || typeof login.username!=='string' || typeof login.password!=='string' || !login.username || login.username.length>20 || !login.password || login.password.length>20)throw new Error('Invalid saved login.');
    if(localStorage.getItem(optOutKey)!=='0')return null;
    return {username:login.username,password:login.password};
  }catch{await record('readwrite',store=>store.clear());return null;}
});}
