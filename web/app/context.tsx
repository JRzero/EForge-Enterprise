import {createContext, useContext} from 'react';
import type {BootstrapResponse} from '../generated/api';
import type {ApplicationApi} from '../integration/api';
import type {NavigationItem} from '../integration/navigation';
export const ApiContext = createContext<ApplicationApi | null>(null);
export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('API context is unavailable.');
  return api;
}
export const BootstrapContext = createContext<BootstrapResponse | null>(null);
export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error('Bootstrap context is unavailable.');
  return value;
}
export const NavigationContext = createContext<readonly NavigationItem[]>([]);
export function useNavigation() {return useContext(NavigationContext);}
export const ApplicationControlsContext = createContext<{
  navigate: (path: string) => void;
  refresh: () => Promise<void>;
  closePage?: (fallback: string) => void;
  href?: string;
  /** Retained pages keep their draft marker while Activity suspends their effects. */
  setPageDirty?: (dirty: boolean) => void;
} | null>(null);
export function useApplicationControls() {
  const value = useContext(ApplicationControlsContext);
  if (!value) throw new Error('Application controls are unavailable.');
  return value;
}
export const NoticeRefreshContext = createContext<() => void>(() => {});
export function useNoticeRefresh() {return useContext(NoticeRefreshContext);}
