import {useCallback,useRef} from 'react';
/** A completed read resumes with retained state; interrupted reads and changed inputs run again. */
export function useRetainedRead(){
  const current=useRef<{inputs:readonly unknown[];completed:boolean}|null>(null);
  return useCallback((inputs:readonly unknown[]):(()=>void)|undefined=>{
    const prior=current.current;
    if(prior?.completed && inputs.length===prior.inputs.length && inputs.every((value,index)=>Object.is(value,prior.inputs[index])))return;
    const operation={inputs:[...inputs],completed:false};current.current=operation;
    return ()=>{if(current.current===operation)operation.completed=true;};
  },[]);
}
