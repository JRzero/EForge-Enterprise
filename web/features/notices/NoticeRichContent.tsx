import 'quill/dist/quill.core.css';
import {sanitizeNoticeHtml} from './rich-text';

export function NoticeRichContent({html}: {html: string}) {
  return <div className="ql-editor notice-content" dangerouslySetInnerHTML={{__html: sanitizeNoticeHtml(html)}} />;
}
