import type {ComponentPropsWithoutRef} from 'react';
import type {TagTone} from './Tag';
export function Feedback({tone = 'info', className = '', ...props}: ComponentPropsWithoutRef<'div'> & {tone?: TagTone}) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} {...props} className={`ui-feedback ${className}`} data-tone={tone}/>;
}
