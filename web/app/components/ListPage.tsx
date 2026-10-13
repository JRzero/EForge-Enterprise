import {Children, Fragment, isValidElement, useId, useState, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {PageHeader} from '../../ui/patterns';
import {NativeButton} from '../../ui/native';

/** Product list layout matching the spcore object-model lists. */
export function ListPage({title, description, eyebrow, showHeader = false, className = '', children}: {
  title: string; description?: string; eyebrow?: string; showHeader?: boolean; className?: string; children: ReactNode;
}) {
  return <section className={`list-page ${className}`}>{showHeader ? <PageHeader title={title} description={description} eyebrow={eyebrow}/> : <h1 className="list-page-title">{title}</h1>}
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

export function ListFilters({children, actions, primaryCount = Infinity, advancedCount = 0, className = '', ...props}: ComponentPropsWithoutRef<'form'> & {
  actions?: ReactNode; primaryCount?: number; advancedCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const advancedId = useId();
  const fields = filterFields(children);
  const hasAdvanced = fields.length > primaryCount;
  return <form {...props} className={`post-filters list-filters ${className}`}>
    {fields.slice(0, primaryCount)}
    <div className="list-filter-actions">{actions}{hasAdvanced && <NativeButton type="button" className="list-filter-toggle" aria-expanded={expanded} aria-controls={advancedId} onClick={() => setExpanded(value => !value)}>
      <span>{expanded ? '收起筛选' : '更多筛选'}</span>
      {advancedCount > 0 && <span className="list-filter-count"><span aria-hidden="true">{advancedCount}</span><span className="list-page-title">{advancedCount} 项已填写</span></span>}
      <svg className="list-filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </NativeButton>}</div>
    {hasAdvanced && <div id={advancedId} className="list-filter-advanced" hidden={!expanded} onInvalidCapture={() => setExpanded(true)}>{fields.slice(primaryCount)}</div>}
  </form>;
}

export function ListToolbar({className = '', ...props}: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`post-toolbar list-toolbar ${className}`}/>;
}
