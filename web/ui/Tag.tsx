import type {ReactNode} from 'react';
export type TagTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';
export function Tag({children, tone = 'info', className = '', onClose, closeLabel}: {children: ReactNode; tone?: TagTone; className?: string; onClose?: () => void; closeLabel?: string}) {
  return <span className={`ui-tag ${className}`} data-tone={tone}>{children}{onClose ? <button type="button" aria-label={closeLabel ?? '移除标签'} onClick={onClose}>×</button> : null}</span>;
}
