import {Children, Fragment, isValidElement, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {PageHeader} from '../../ui/patterns';

/** Product list layout matching the spcore object-model lists. */
export function ListPage({title, description, eyebrow, className = '', children}: {
  title: string; description?: string; eyebrow?: string; className?: string; children: ReactNode;
}) {
  return <section className={`list-page ${className}`}><PageHeader title={title} description={description} eyebrow={eyebrow}/>
    <div className="list-page-body">{children}</div></section>;
}

// React.Children flattens arrays, but treats a Fragment as a single child.
// Expand only fragments so conditional fields each get their own layout cell.
function filterFields(children: ReactNode, parentKey = ''): ReactNode[] {
  return Children.toArray(children).flatMap((field, index) => {
    const key = `${parentKey}/${isValidElement(field) ? field.key ?? index : index}`;
    if (isValidElement<{children?: ReactNode}>(field) && field.type === Fragment) {
      return filterFields(field.props.children, key);
    }
    return [<div className="list-filter-field" key={key}>{field}</div>];
  });
}

export function ListFilters({children, actions, className = '', ...props}: ComponentPropsWithoutRef<'form'> & {actions?: ReactNode}) {
  return <form {...props} className={`post-filters list-filters ${className}`}>
    {filterFields(children)}
    {actions && <div className="list-filter-actions">{actions}</div>}
  </form>;
}

export function ListToolbar({className = '', ...props}: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`post-toolbar list-toolbar ${className}`}/>;
}
