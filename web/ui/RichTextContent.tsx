import 'quill/dist/quill.core.css';
import {useEffect} from 'react';
import {sanitizeNoticeHtml} from './rich-text-security';

export function RichTextContent({html, onReady}: {html: string; onReady?: () => void}) {
  useEffect(() => {onReady?.();}, [html, onReady]);
  return <div className="ql-editor notice-content" dangerouslySetInnerHTML={{__html: sanitizeNoticeHtml(html)}} />;
}
