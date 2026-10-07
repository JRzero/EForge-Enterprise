import {useEffect, useState, type FormEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import type {SessionRuntime} from '../../integration/session';
import type {CaptchaChallenge} from '../../integration/legacy-auth';
import {errorMessage} from '../../integration/errors';

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
    if (busy || !challenge) return;
    if (!username.trim() || username.trim().length > 20 || !password || password.length > 20 || code.length > 128) {
      setError('账号和密码须为 1–20 个字符，请检查填写内容。'); return;
    }
    if (challenge.enabled && !code.trim()) { setError('请输入验证码。'); return; }
    setBusy(true); setError('');
    try {
      await runtime.login({username: username.trim(), password,
        ...(challenge.enabled ? {code, uuid: challenge.uuid} : {})});
      setPassword('');
    } catch (cause) {
      setError(errorMessage(cause)); setPassword(''); refreshCaptcha();
    } finally { setBusy(false); }
  }
  return <main className="login-layout">
    <section className="login-story" aria-label="EForge Enterprise">
      <span className="brand-mark">E</span><span className="brand-name">EForge Enterprise</span>
      <div className="login-story-copy"><p className="eyebrow">让工作有序，让协作简单</p>
        <h1>从这里，<br />开始今天的工作。</h1><p>一个入口，连接你的团队与日常事务。</p></div>
      <span className="login-story-footer">你的工作空间 · EForge Enterprise</span>
    </section>
    <section className="login-panel"><div className="login-card">
      <p className="eyebrow">欢迎回来</p><h2>登录工作空间</h2><p className="muted">使用你的企业账号继续。</p>
      <form onSubmit={event => { void submit(event); }}>
        <Input label="账号" htmlName="username" autoComplete="username" value={username} onChange={setUsername}
          aria-required="true" isDisabled={busy} />
        <Input label="密码" htmlName="password" type="password" autoComplete="current-password" value={password}
          onChange={setPassword} aria-required="true" isDisabled={busy} />
        {challenge?.enabled ? <div className="captcha-row">
          <Input label="验证码" htmlName="code" value={code} onChange={setCode} aria-required="true" isDisabled={busy} />
          <button type="button" className="captcha-image" onClick={refreshCaptcha} disabled={busy} aria-label="更换验证码">
            <img src={challenge.image} alt="登录验证码" /><span>换一张</span>
          </button></div> : null}
        {captchaError ? <div role="alert"><p>{captchaError}</p><Button label="重新获取验证码" onClick={refreshCaptcha} variant="ghost" /></div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <Button label={busy ? '正在登录…' : captchaLoading ? '准备中…' : '登录'} type="submit"
          isDisabled={busy || captchaLoading || !challenge} />
      </form>{registrationEnabled && onRegister ? <a href="/register" onClick={event=>{if(busy){event.preventDefault();return;}if(!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onRegister();}}}>注册账号</a> : null}<p className="login-help">账号遇到问题？请联系企业管理员。</p>
    </div></section>
  </main>;
}
