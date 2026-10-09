import type {ComponentPropsWithRef} from 'react';

/** Native controls share product styling without changing browser semantics. */
export function NativeInput(props: ComponentPropsWithRef<'input'>) {return <input {...props}/>;}
export function NativeButton(props: ComponentPropsWithRef<'button'>) {return <button {...props}/>;}
export function Select({className='',...props}: ComponentPropsWithRef<'select'>) {return <select {...props} className={`ui-select ${className}`}/>;}
export function TextareaControl({className='',...props}: ComponentPropsWithRef<'textarea'>) {return <textarea {...props} className={`ui-textarea ${className}`}/>;}
export function Table(props: ComponentPropsWithRef<'table'>) {return <table {...props}/>;}
