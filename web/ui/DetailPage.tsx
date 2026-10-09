import type {ReactNode} from 'react';
import {FormActions} from './FormPage';

/** Read-only counterpart of the horizontal form template. */
export function DetailPage({title,description,children,actions}: {title:string;description?:string;children:ReactNode;actions?:ReactNode}) {
  return <section className="detail-page template-page"><header className="template-page-header"><h1>{title}</h1>{description&&<p>{description}</p>}</header><div className="template-page-body">{children}</div>{actions&&<FormActions>{actions}</FormActions>}</section>;
}
export function DetailSection({title,children}: {title:string;children:ReactNode}) {
  return <section className="detail-section"><h2>{title}</h2><dl className="detail-fields">{children}</dl></section>;
}
export function DetailField({label,children}: {label:string;children:ReactNode}) {
  return <div className="detail-field"><dt>{label}</dt><dd>{children ?? '—'}</dd></div>;
}
