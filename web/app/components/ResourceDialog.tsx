import {useEffect, useRef, type ReactNode} from 'react';

/** Native modal focus/escape behavior shared by the verified resource editors. */
export function ResourceDialog({titleId, alert = false, busy, onCancel, children, closeOnBackdrop = false}: {
  titleId: string; closeOnBackdrop?: boolean; alert?: boolean; busy: boolean; onCancel: () => void; children: ReactNode;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = element.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={element} className="post-dialog" role={alert ? 'alertdialog' : 'dialog'} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} onClick={event => {
      if (!closeOnBackdrop || busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}>{children}</dialog>;
}
