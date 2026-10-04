import {useDictionary, DictionaryNotice} from '../../app/useDictionary';
import {useEffect, useState, type FormEvent} from 'react';
import {PageHeader} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {ProfileResponse, UpdateProfileRequest} from '../../generated/api';
import {useApi, useApplicationControls} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {AvatarDialog} from './AvatarDialog';

export function ProfilePage() {
  const sexDictionary = useDictionary('sys_user_sex');
  const api = useApi(); const controls = useApplicationControls();
  const [profile, setProfile] = useState<ProfileResponse | null>(null); const [version, setVersion] = useState(0);
  const [form, setForm] = useState<UpdateProfileRequest>({displayName:'',email:'',phone:'',sex:'2'});
  const [passwords, setPasswords] = useState({oldPassword:'',newPassword:'',confirmPassword:''}); const [showPasswords, setShowPasswords] = useState(false);
  const [tab, setTab] = useState<'profile' | 'password'>('profile'); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [feedback, setFeedback] = useState(''); const [loadError, setLoadError] = useState(''); const [avatar, setAvatar] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoadError(''); setProfile(null);
    api.getMyProfile(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setProfile(result); setForm({displayName:result.displayName,email:result.email ?? '',phone:result.phone ?? '',sex:result.sex ?? '2'});
    }).catch(cause => { if (!controller.signal.aborted) setLoadError(errorMessage(cause)); });
    return () => controller.abort();
  }, [api,version]);
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError(''); setFeedback('');
    if (!form.displayName.trim() || form.displayName.length > 30 || !/^1[3-9][0-9]{9}$/.test(form.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.email.length > 50) {
      setError('请填写昵称、正确的手机号码和邮箱，昵称最多 30 字。'); return;
    }
    setBusy(true);
    try { await api.updateMyProfile(form); const result = await api.getMyProfile(); setProfile(result); await controls.refresh(); setFeedback('个人资料已保存。'); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError(''); setFeedback('');
    if (!passwords.oldPassword || passwords.newPassword.length < 6 || passwords.newPassword.length > 20 || /[<>"'|\\]/.test(passwords.newPassword)) {
      setError('请输入旧密码，新密码需为 6–20 位，不能包含非法字符。'); return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) { setError('两次输入的新密码不一致。'); return; }
    setBusy(true);
    try { await api.changeMyPassword({oldPassword:passwords.oldPassword,newPassword:passwords.newPassword}); setPasswords({oldPassword:'',newPassword:'',confirmPassword:''}); setShowPasswords(false); setFeedback('密码已修改，请使用新密码登录。'); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <section className="profile-page"><PageHeader title="个人中心" description="维护个人资料、登录密码和头像。" /><DictionaryNotice dictionary={sexDictionary} />
    {loadError ? <div><p role="alert">{loadError}</p><Button label="重试加载个人资料" onClick={() => setVersion(value => value+1)} /></div> : !profile ? <p role="status">正在加载个人资料…</p> :
    <div className="profile-layout"><aside className="profile-summary"><h2>个人信息</h2>
      <button className="profile-avatar" onClick={() => setAvatar(true)} aria-label="修改头像" disabled={busy}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="当前头像" /> : <span aria-hidden="true">{profile.displayName.slice(0,1)}</span>}</button>
      <dl>{[['登录账号',profile.username],['用户昵称',profile.displayName],['手机号码',profile.phone],['邮箱',profile.email],['所属部门',profile.departmentName],['所属角色',profile.roleNames],['所属岗位',profile.postNames],['创建日期',profile.createdAt ? new Date(profile.createdAt).toLocaleString('zh-CN') : '']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || '暂无'}</dd></div>)}</dl>
    </aside><div className="profile-editor"><div role="tablist" aria-label="个人中心设置" onKeyDown={event => {
      if (busy || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key==='Home' ? 'profile' : event.key==='End' ? 'password' : tab==='profile' ? 'password' : 'profile';
      setTab(next); setError(''); setFeedback(''); event.currentTarget.querySelector<HTMLButtonElement>(`#${next}-tab`)?.focus();
    }}><button role="tab" id="profile-tab" aria-controls="profile-panel" aria-selected={tab==='profile'} tabIndex={tab==='profile' ? 0 : -1} disabled={busy} onClick={() => { setTab('profile');setError('');setFeedback(''); }}>基本资料</button>
      <button role="tab" id="password-tab" aria-controls="password-panel" aria-selected={tab==='password'} tabIndex={tab==='password' ? 0 : -1} disabled={busy} onClick={() => { setTab('password');setError('');setFeedback(''); }}>修改密码</button></div>
      {error ? <p role="alert">{error}</p> : null}{feedback ? <p role="status">{feedback}</p> : null}
      {tab==='profile' ? <form role="tabpanel" id="profile-panel" aria-labelledby="profile-tab" onSubmit={event => { void saveProfile(event); }} noValidate>
        <Input label="用户昵称" value={form.displayName} onChange={value => setForm({...form,displayName:value})} isDisabled={busy} />
        <Input label="手机号码" value={form.phone} onChange={value => setForm({...form,phone:value})} isDisabled={busy} />
        <Input label="邮箱" type="email" value={form.email} onChange={value => setForm({...form,email:value})} isDisabled={busy} />
        <fieldset disabled={busy}><legend>性别</legend>{sexDictionary.options.map(({value, label}, index) => <label key={`${value}-${index}`}><input type="radio" name="profile-sex" value={value} checked={form.sex===value} onChange={() => setForm({...form,sex:value})} />{label}</label>)}</fieldset>
        <div className="post-row-actions"><Button label={busy ? '正在保存资料…' : '保存资料'} type="submit" isDisabled={busy} /><Button label="关闭个人中心" variant="ghost" isDisabled={busy} onClick={() => controls.navigate('/dashboard')} /></div>
      </form> : <form role="tabpanel" id="password-panel" aria-labelledby="password-tab" onSubmit={event => { void savePassword(event); }} noValidate>
        {(['oldPassword','newPassword','confirmPassword'] as const).map((key,index) => <Input key={key} label={['旧密码','新密码','确认新密码'][index]!} type={showPasswords ? 'text' : 'password'} value={passwords[key]} onChange={value => setPasswords({...passwords,[key]:value})} isDisabled={busy} />)}
        <label className="profile-show-password"><input type="checkbox" checked={showPasswords} disabled={busy} onChange={event => setShowPasswords(event.target.checked)} />显示密码</label>
        <div className="post-row-actions"><Button label={busy ? '正在修改密码…' : '保存密码'} type="submit" isDisabled={busy} /><Button label="关闭个人中心" variant="ghost" isDisabled={busy} onClick={() => controls.navigate('/dashboard')} /></div>
      </form>}
    </div></div>}
    {avatar && profile ? <AvatarDialog avatarUrl={profile.avatarUrl} onCancel={() => setAvatar(false)} onSaved={async () => { const result = await api.getMyProfile();setProfile(result);setAvatar(false);setFeedback('头像已保存。'); }} /> : null}
  </section>;
}
