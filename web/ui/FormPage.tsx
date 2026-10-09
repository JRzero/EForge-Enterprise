import type {ComponentPropsWithRef, ReactNode} from 'react';

export function FormPage({title, description, eyebrow, children}: {title: string; description?: string; eyebrow?: string; children: ReactNode}) {
  return <section className="form-page template-page"><header className="template-page-header">{eyebrow&&<p>{eyebrow}</p>}<h1>{title}</h1>{description&&<p>{description}</p>}</header><div className="template-page-body">{children}</div></section>;
}
export function PageForm({className = '', children, actions, ...props}: ComponentPropsWithRef<'form'> & {actions?: ReactNode}) {
  return <form {...props} className={`enterprise-form ${className}`}>{children}{actions ? <FormActions>{actions}</FormActions> : null}</form>;
}
export function FormActions({children}: {children: ReactNode}) {return <div className="form-actions">{children}</div>;}
export function FormSection({title, children}: {title: string; children: ReactNode}) {
  return <fieldset className="form-section"><legend>{title}</legend>{children}</fieldset>;
}
