import {createContext, useContext} from 'react';
import type {BootstrapResponse} from '../generated/api';
export const BootstrapContext = createContext<BootstrapResponse | null>(null);
export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error('Bootstrap context is unavailable.');
  return value;
}
