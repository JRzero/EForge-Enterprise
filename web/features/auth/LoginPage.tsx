import {NativeButton, NativeInput} from '../../ui/native';
import {PageForm} from '../../ui/FormPage';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Button, Input} from '../../ui/controls';
import type {SessionRuntime} from '../../integration/session';
import type {CaptchaChallenge} from '../../integration/legacy-auth';
import {errorMessage} from '../../integration/errors';
import {clearRememberedLogin,loadRememberedLogin,saveRememberedLogin} from './remembered-login';
import {AuthenticationLayout} from './AuthenticationLayout';

export function LoginPage({runtime, onRegister}: {runtime: SessionRuntime; onRegister?: () => void}) {
  const [registrationEnabled,setRegistrationEnabled]=useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaError, setCaptchaError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember,setRemember]=useState(false);
  const [rememberReady,setRememberReady]=useState(false);
  const [rememberError,setRememberError]=useState('');
  const [rememberFeedback,setRememberFeedback]=useState('');
  const credentialEdited=useRef(false);
  const formOwnership=useRef(0);
  useEffect(()=>{
    let owned=true;const ownership=formOwnership;
    loadRememberedLogin().then(saved=>{if(owned && !credentialEdited.current && saved){setUsername(saved.username);setPassword(saved.password);setRemember(true);}}).catch(()=>{if(owned)setRememberError('此浏览器暂时无法读取已记住的密码，仍可正常登录。');}).finally(()=>{if(owned)setRememberReady(true);});
    return ()=>{owned=false;ownership.current++;};
  },[]);
  function changeRemember(checked:boolean){
    credentialEdited.current=true;setRemember(checked);setRememberError('');
    const owner=++formOwnership.current;
    setRememberFeedback('');
    if(!checked){setRememberReady(false);void clearRememberedLogin().then(()=>{if(owner===formOwnership.current)setRememberFeedback('已清除本浏览器记住的密码。');}).catch(()=>{if(owner===formOwnership.current)setRememberError('无法删除已记住的密码，请清除此网站的浏览器数据。');}).finally(()=>{if(owner===formOwnership.current)setRememberReady(true);});}
  }
  useEffect(() => {
    const controller = new AbortController();
    runtime.api.registrationStatus(controller.signal).then(value=>{if(!controller.signal.aborted)setRegistrationEnabled(value.enabled);}).catch(()=>{if(!controller.signal.aborted)setRegistrationEnabled(false);});
    runtime.api.captcha(controller.signal).then(value => {
      if (!controller.signal.aborted) { setChallenge(value); setCaptchaLoading(false); }
    }).catch(cause => {
      if (!controller.signal.aborted) { setCaptchaError(errorMessage(cause)); setCaptchaLoading(false); }
    });
    return () => controller.abort();
  }, [runtime, challengeVersion]);
  function refreshCaptcha() {
    setCode(''); setChallenge(null); setCaptchaError(''); setCaptchaLoading(true);
    setChallengeVersion(value => value + 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !challenge || !rememberReady) return;
    if (!username.trim() || username.trim().length > 20 || !password || password.length > 20 || code.length > 128) {
      setError('账号和密码须为 1–20 个字符，请检查填写内容。'); return;
    }
    if (challenge.enabled && !code.trim()) { setError('请输入验证码。'); return; }
    const owner=++formOwnership.current;
    setBusy(true); setError('');
    try {
      if(remember){try{await saveRememberedLogin({username:username.trim(),password});}catch{if(owner===formOwnership.current)setRememberError('无法记住密码，请取消勾选后登录。');return;}}
      else{try{await clearRememberedLogin();}catch{if(owner===formOwnership.current)setRememberError('无法删除已记住的密码，请清除此网站的浏览器数据。');}}
      if(owner!==formOwnership.current)return;
      await runtime.login({username: username.trim(), password,
        ...(challenge.enabled ? {code, uuid: challenge.uuid} : {})});
      if(owner===formOwnership.current)setPassword('');
    } catch (cause) {
      if(owner===formOwnership.current){setError(errorMessage(cause));setPassword('');refreshCaptcha();}
    } finally { if(owner===formOwnership.current)setBusy(false); }
  }
  return <AuthenticationLayout>
      <p className="eyebrow">欢迎回来</p><h2>登录工作空间</h2><p className="muted">使用你的企业账号继续。</p>
      <PageForm onSubmit={event => { void submit(event); }}>
        <Input label="账号" htmlName="username" autoComplete="username" value={username} onChange={value=>{credentialEdited.current=true;setUsername(value);}}
          aria-required="true" isDisabled={busy} />
        <Input label="密码" htmlName="password" type="password" autoComplete="current-password" value={password}
          onChange={value=>{credentialEdited.current=true;setPassword(value);}} aria-required="true" isDisabled={busy} />
        {challenge?.enabled ? <div className="captcha-row">
          <Input label="验证码" htmlName="code" value={code} onChange={setCode} aria-required="true" isDisabled={busy} />
          <NativeButton type="button" className="captcha-image" title="点击更换验证码" onClick={refreshCaptcha} disabled={busy} aria-label="更换验证码">
            <img src={challenge.image} alt="登录验证码" /><span>换一张</span>
          </NativeButton></div> : null}
        <label className="login-remember"><NativeInput type="checkbox" checked={remember} disabled={busy || !rememberReady} onChange={event=>changeRemember(event.target.checked)} />在此浏览器记住密码（30天）</label>
        {rememberFeedback ? <p role="status">{rememberFeedback}</p> : null}
        {rememberError ? <p role="alert" className="form-error">{rememberError}</p> : null}
        {captchaError ? <div role="alert"><p>{captchaError}</p><Button label="重新获取验证码" onClick={refreshCaptcha} variant="ghost" /></div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <Button label={busy ? '正在登录…' : captchaLoading ? '准备中…' : '登录'} type="submit"
          isDisabled={busy || captchaLoading || !challenge || !rememberReady} />
      </PageForm>{registrationEnabled && onRegister ? <a href="/register" onClick={event=>{if(busy){event.preventDefault();return;}if(!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onRegister();}}}>注册账号</a> : null}<p className="login-help">账号遇到问题？请联系企业管理员。</p>
  </AuthenticationLayout>;
}
