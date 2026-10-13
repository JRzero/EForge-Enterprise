import type {ReactNode} from 'react';
import {Button} from './controls';
import {Feedback} from './Feedback';

export type AsyncContentProps = {
  loading:boolean; error?:string|null; empty?:boolean;
  loadingText?:string; emptyText?:string; retryLabel?:string;
  onRetry?:()=>void; children:ReactNode;
};

/** Explicit exclusive states. Use the table's own loading state for background refreshes. */
export function AsyncContent({loading,error,empty=false,loadingText='正在加载…',emptyText='暂无数据',retryLabel='重试',onRetry,children}:AsyncContentProps) {
  if(loading)return <Feedback aria-busy="true">{loadingText}</Feedback>;
  if(error)return <Feedback tone="danger"><p>{error}</p>{onRetry?<Button type="button" label={retryLabel} onClick={onRetry}/>:null}</Feedback>;
  if(empty)return <Feedback>{emptyText}</Feedback>;
  return <>{children}</>;
}
