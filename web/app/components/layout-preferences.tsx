import {createContext,useContext,useState,type Dispatch,type SetStateAction} from 'react';
export type LayoutPreferences={navMode:'left'|'mixed'|'top';sideTheme:'dark'|'light';theme:string;density:'default'|'medium'|'small'|'mini';tagsView:boolean;tagsViewPersist?:boolean;tagsIcon:boolean;fixedHeader:boolean;sidebarLogo:boolean;dynamicTitle:boolean;footerVisible:boolean;footerContent:string};
export const layoutDefaults:LayoutPreferences={navMode:'left',sideTheme:'dark',theme:'#315c4d',density:'default',tagsView:true,tagsIcon:false,fixedHeader:true,sidebarLogo:true,dynamicTitle:false,footerVisible:false,footerContent:'Copyright © 2026 EForge Enterprise'};
const key='eforge.enterprise.layout.v1';
export function readLayoutPreferences():LayoutPreferences {
  try {
    const raw=localStorage.getItem(key);const value=raw && raw.length<=8192 ? JSON.parse(raw) : {};
    if(!value || typeof value!=='object' || Array.isArray(value))return {...layoutDefaults};
    const result={...layoutDefaults};
    const oldMode=localStorage.getItem('eforge.enterprise.navigation.v1');
    if(value.navMode==='left'||value.navMode==='mixed'||value.navMode==='top')result.navMode=value.navMode;
    else if(oldMode==='mixed'||oldMode==='top')result.navMode=oldMode;
    if(value.sideTheme==='dark'||value.sideTheme==='light')result.sideTheme=value.sideTheme;
    if(typeof value.theme==='string' && /^#[0-9a-f]{6}$/i.test(value.theme))result.theme=value.theme;
    if(['default','medium','small','mini'].includes(value.density))result.density=value.density;
    for(const property of ['tagsView','tagsViewPersist','tagsIcon','fixedHeader','sidebarLogo','dynamicTitle','footerVisible'] as const)if(typeof value[property]==='boolean')result[property]=value[property];
    if(typeof value.footerContent==='string' && value.footerContent.length<=1024)result.footerContent=value.footerContent;
    return result;
  }catch{return {...layoutDefaults};}
}
export function useLayoutPreferences(ownerId:string){const [preferences,setPreferences]=useState(readLayoutPreferences);return {preferences,setPreferences,save:()=>{localStorage.setItem(key,JSON.stringify(preferences));},reset:()=>{localStorage.removeItem(key);localStorage.removeItem('eforge.enterprise.navigation.v1');localStorage.removeItem('eforge.enterprise.page-tabs.v1.'+ownerId);setPreferences({...layoutDefaults,tagsViewPersist:false});}};}
export const LayoutContext=createContext<LayoutPreferences>(layoutDefaults);
export function useLayout(){return useContext(LayoutContext);}
export const LayoutChangesContext=createContext<Dispatch<SetStateAction<LayoutPreferences>>|null>(null);
export function useLayoutChanges(){return useContext(LayoutChangesContext);}

export function saveLayoutDensity(preferences:LayoutPreferences){localStorage.setItem(key,JSON.stringify(preferences));}
