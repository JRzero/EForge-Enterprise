import {test,expect} from './fixtures';
async function loginFixture(page:import('@playwright/test').Page){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'remember-fixture',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'7',username:'ordinary',displayName:'普通用户'},roles:[],permissions:[],navigation:[]}}));
  await page.goto('/login');await expect(page.getByRole('button',{name:'登录',exact:true})).toBeEnabled();
}
test('explicit remembered login encrypts both credentials with a non-exportable random key and restores without automatic login',async({page})=>{
  let requests=0;await loginFixture(page);await page.route('**/api/v1/auth/login',route=>{requests++;return route.fulfill({json:{accessToken:'remember-fixture',tokenType:'Bearer'}});});
  const remember=page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'});await expect(remember).not.toBeChecked();
  await page.getByLabel('账号',{exact:true}).fill('ordinary');await page.getByLabel('密码',{exact:true}).fill('Remember123');await remember.check();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();expect(requests).toBe(1);
  const proof=await page.evaluate(async()=>{
    const saved=await new Promise<{key:CryptoKey;ciphertext:ArrayBuffer;iv:Uint8Array;expiresAt:number}>(resolve=>{const request=indexedDB.open('eforge-remembered-login',1);request.onsuccess=()=>{const database=request.result;const read=database.transaction('credential').objectStore('credential').get('current');read.onsuccess=()=>{resolve(read.result);database.close();};};});
    let exported=false;try{await crypto.subtle.exportKey('raw',saved.key);exported=true;}catch{/* non-extractable key must reject export */}
    return {exported,extractable:saved.key.extractable,keyType:saved.key.algorithm.name,ivLength:saved.iv.length,ciphertext:new TextDecoder().decode(saved.ciphertext),expires:saved.expiresAt-Date.now(),ordinaryStorage:JSON.stringify({...localStorage,...sessionStorage}),cookies:document.cookie};
  });expect(proof.exported).toBe(false);expect(proof.extractable).toBe(false);expect(proof.keyType).toBe('AES-GCM');expect(proof.ivLength).toBe(12);expect(proof.expires).toBeGreaterThan(29*86400000);expect(proof.expires).toBeLessThanOrEqual(30*86400000);for(const secret of ['ordinary','Remember123']){expect(proof.ciphertext).not.toContain(secret);expect(proof.ordinaryStorage).not.toContain(secret);expect(proof.cookies).not.toContain(secret);}
  await page.evaluate(()=>sessionStorage.clear());await page.goto('/login');await expect(page.getByLabel('账号',{exact:true})).toHaveValue('ordinary');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('Remember123');await expect(remember).toBeChecked();expect(requests).toBe(1);
  await remember.uncheck();await expect(page.getByRole('status').filter({hasText:'已清除本浏览器记住的密码。'})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeEnabled();await expect(page.getByLabel('账号',{exact:true})).toHaveValue('');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');await expect(remember).not.toBeChecked();expect(requests).toBe(1);
});
test('expired and authenticated metadata-tampered records are cleared, while ordered save then opt-out cannot resurrect credentials',async({page})=>{
  await loginFixture(page);
  const proof=await page.evaluate(async()=>{
    const modulePath='/features/auth/remembered-login.ts';const savedLogin=await import(modulePath);
    const mutate=async(expiresAt:number)=>new Promise<void>((resolve,reject)=>{const open=indexedDB.open('eforge-remembered-login',1);open.onsuccess=()=>{const database=open.result,transaction=database.transaction('credential','readwrite'),store=transaction.objectStore('credential'),get=store.get('current');get.onsuccess=()=>store.put({...get.result,expiresAt},'current');transaction.oncomplete=()=>{database.close();resolve();};transaction.onerror=()=>reject(new Error('Fixture storage failed'));};});
    await savedLogin.saveRememberedLogin({username:'ordinary',password:'Remember123'});await mutate(Date.now()-1);const expired=await savedLogin.loadRememberedLogin();
    await savedLogin.saveRememberedLogin({username:'ordinary',password:'Remember123'});await mutate(Date.now()+100000);const tampered=await savedLogin.loadRememberedLogin();
    await Promise.all([savedLogin.saveRememberedLogin({username:'ordinary',password:'Remember123'}),savedLogin.clearRememberedLogin()]);const afterClear=await savedLogin.loadRememberedLogin();
    return {expired,tampered,afterClear};
  });expect(proof).toEqual({expired:null,tampered:null,afterClear:null});await page.reload();await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');
});
test('unsupported private storage allows ordinary login, but never pretends an opted-in password was saved',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true}));let requests=0;await loginFixture(page);await page.route('**/api/v1/auth/login',route=>{requests++;return route.fulfill({json:{accessToken:'remember-fixture',tokenType:'Bearer'}});});
  await expect(page.getByRole('alert')).toContainText('仍可正常登录');await page.getByLabel('账号',{exact:true}).fill('ordinary');await page.getByLabel('密码',{exact:true}).fill('Remember123');await page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'}).check();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('alert')).toContainText('无法记住密码');expect(requests).toBe(0);
  await page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'}).uncheck();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();expect(requests).toBe(1);
});

test('leaving while encryption is pending cannot submit an orphan login',async({page})=>{
  let requests=0;await loginFixture(page);await page.route('**/api/v1/auth/login',route=>{requests++;return route.fulfill({json:{accessToken:'orphan-fixture',tokenType:'Bearer'}});});
  await page.evaluate(()=>{const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);Object.assign(window,{releaseRememberedEncryption:release});Object.defineProperty(crypto.subtle,'encrypt',{configurable:true,value:async(...args:Parameters<SubtleCrypto['encrypt']>)=>{await gate;return encrypt(...args);}});});
  await page.getByLabel('账号',{exact:true}).fill('ordinary');await page.getByLabel('密码',{exact:true}).fill('Remember123');await page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'}).check();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('checkbox')).toBeDisabled();
  await page.evaluate(()=>{history.pushState(null,'','/register');dispatchEvent(new PopStateEvent('popstate'));});await expect(page.getByRole('status')).toContainText('注册暂未开放');
  await page.evaluate(async()=>{(window as unknown as {releaseRememberedEncryption:()=>void}).releaseRememberedEncryption();const modulePath='/features/auth/remembered-login.ts';const savedLogin=await import(modulePath);await savedLogin.loadRememberedLogin();});expect(requests).toBe(0);await expect(page).toHaveURL(/\/register$/);
});

test('late restoration never overwrites credentials already entered on the current form',async({page})=>{
  await loginFixture(page);await page.evaluate(async()=>{const modulePath='/features/auth/remembered-login.ts';const savedLogin=await import(modulePath);await savedLogin.saveRememberedLogin({username:'ordinary',password:'Remember123'});});
  await page.addInitScript(()=>{const decrypt=crypto.subtle.decrypt.bind(crypto.subtle);let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);Object.assign(window,{releaseRememberedRestore:release});Object.defineProperty(crypto.subtle,'decrypt',{configurable:true,value:async(...args:Parameters<SubtleCrypto['decrypt']>)=>{await gate;return decrypt(...args);}});});
  await page.reload();await page.getByLabel('账号',{exact:true}).fill('new-account');await page.getByLabel('密码',{exact:true}).fill('Different123');await page.evaluate(()=>(window as unknown as {releaseRememberedRestore:()=>void}).releaseRememberedRestore());await expect(page.getByRole('button',{name:'登录',exact:true})).toBeEnabled();await expect(page.getByLabel('账号',{exact:true})).toHaveValue('new-account');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('Different123');await expect(page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'})).not.toBeChecked();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();expect(await page.evaluate(async()=>{const modulePath='/features/auth/remembered-login.ts';const savedLogin=await import(modulePath);return savedLogin.loadRememberedLogin();})).toBeNull();
});

test('synchronous opt-out prevents reload from reviving credentials even when physical deletion fails',async({page})=>{
  await loginFixture(page);await page.evaluate(async()=>{const modulePath='/features/auth/remembered-login.ts';const savedLogin=await import(modulePath);await savedLogin.saveRememberedLogin({username:'ordinary',password:'Remember123'});});await page.reload();await expect(page.getByLabel('密码',{exact:true})).toHaveValue('Remember123');
  await page.evaluate(()=>Object.defineProperty(indexedDB,'open',{configurable:true,value:()=>{throw new Error('Fixture unavailable database');}}));await page.getByRole('checkbox',{name:'在此浏览器记住密码（30天）'}).uncheck();await expect(page.getByRole('alert')).toContainText('无法删除');await page.reload();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeEnabled();await expect(page.getByLabel('账号',{exact:true})).toHaveValue('');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');await expect(page.getByRole('checkbox')).not.toBeChecked();
});
