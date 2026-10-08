import type {ComponentPropsWithRef} from 'react';

/** Native controls share product styling without changing browser semantics. */
export function NativeInput(props: ComponentPropsWithRef<'input'>) {return <input {...props}/>;}
export function NativeButton(props: ComponentPropsWithRef<'button'>) {return <button {...props}/>;}
export function Select(props: ComponentPropsWithRef<'select'>) {return <select {...props}/>;}
export function TextareaControl(props: ComponentPropsWithRef<'textarea'>) {return <textarea {...props}/>;}
export function Table(props: ComponentPropsWithRef<'table'>) {return <table {...props}/>;}
