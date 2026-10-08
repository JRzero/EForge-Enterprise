import {Children, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {PageHeader} from '../../ui/patterns';

/** Product list layout matching the spcore object-model lists. */
export function ListPage({title, description, eyebrow, className = '', children}: {
  title: string; description?: string; eyebrow?: string; className?: string; children: ReactNode;
}) {
  return <section className={`list-page ${className}`}><PageHeader title={title} description={description} eyebrow={eyebrow}/>
    <div className="list-page-body">{children}</div></section>;
}

export function ListFilters({children, actions, className = '', ...props}: ComponentPropsWithoutRef<'form'> & {actions?: ReactNode}) {
  return <form {...props} className={`post-filters list-filters ${className}`}>
    {Children.toArray(children).map((field, index) => <div className="list-filter-field" key={index}>{field}</div>)}
    {actions && <div className="list-filter-actions">{actions}</div>}
  </form>;
}

export function ListToolbar({className = '', ...props}: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`post-toolbar list-toolbar ${className}`}/>;
}
