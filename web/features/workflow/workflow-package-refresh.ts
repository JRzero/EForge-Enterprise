import {useSyncExternalStore} from 'react';

let revision=0;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function refreshWorkflowPackages(){revision++;listeners.forEach(listener=>listener());}
export function useWorkflowPackageRevision(){return useSyncExternalStore(subscribe,()=>revision);}
