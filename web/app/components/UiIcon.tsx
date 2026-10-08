import type {CSSProperties} from 'react';

export type UiIconName = 'menu' | 'settings' | 'search' | 'fullscreen' | 'code' | 'help' | 'bell' | 'lock' | 'logout' | 'chevron';
const paths: Record<UiIconName, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
  fullscreen: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
  code: 'M8 5 2 12l6 7M16 5l6 7-6 7M14 3l-4 18',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  lock: 'M6 10h12v11H6V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  logout: 'M9 3H3v18h6M14 7l5 5-5 5M7 12h12',
  chevron: 'm7 9 5 5 5-5'
};
export function UiIcon({name, style}: {name: UiIconName; style?: CSSProperties}) {
  return <svg className="ui-icon" style={style} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
