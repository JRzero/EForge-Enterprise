import type {ComponentPropsWithRef, ReactNode} from 'react';
import {ListPage} from '../app/components/ListPage';

export function FormPage({title, description, eyebrow, children}: {title: string; description?: string; eyebrow?: string; children: ReactNode}) {
  return <ListPage title={title} description={description} eyebrow={eyebrow} className="form-page">{children}</ListPage>;
}
export function PageForm({className = '', children, actions, ...props}: ComponentPropsWithRef<'form'> & {actions?: ReactNode}) {
  return <form {...props} className={`enterprise-form ${className}`}>{children}{actions ? <FormActions>{actions}</FormActions> : null}</form>;
}
export function FormActions({children}: {children: ReactNode}) {return <div className="form-actions">{children}</div>;}
export function FormSection({title, children}: {title: string; children: ReactNode}) {
  return <fieldset className="form-section"><legend>{title}</legend>{children}</fieldset>;
}
