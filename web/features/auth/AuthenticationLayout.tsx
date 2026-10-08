import type {ReactNode} from 'react';

/** Shared centered account panel, following the reference login/register layout. */
export function AuthenticationLayout({children}:{children:ReactNode}) {
  return <main className="login-layout"><section className="login-panel">
    <div className="login-card"><p className="auth-brand"><span className="brand-mark" aria-hidden="true">E</span>EForge Enterprise</p>{children}</div>
  </section><footer className="login-footer">EForge Enterprise · 企业工作空间</footer></main>;
}
