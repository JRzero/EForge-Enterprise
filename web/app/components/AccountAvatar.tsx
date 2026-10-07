import {useState} from 'react';
import type {UserSummary} from '../../generated/api';
export function AccountAvatar({user}: {user: UserSummary}) {
  const [failed,setFailed]=useState(false);
  const source=user.avatarUrl && /^\/profile\/[A-Za-z0-9/_-]+\.[A-Za-z0-9]+$/.test(user.avatarUrl) ? user.avatarUrl : null;
  return source && !failed ? <img className="header-account-avatar" src={source} alt="" aria-hidden="true" onError={()=>setFailed(true)}/> : <span className="header-account-avatar header-account-avatar-fallback" aria-hidden="true">{Array.from(user.displayName)[0] || 'E'}</span>;
}