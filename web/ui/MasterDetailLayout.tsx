import type {ReactNode} from 'react';

/** Composes inside an existing editor form; never nests a second form. */
export function MasterDetailLayout({master,children}: {master:ReactNode;children:ReactNode}) {
  return <div className="master-detail-layout"><div className="master-detail-fields">{master}</div><div className="master-detail-lines">{children}</div></div>;
}
