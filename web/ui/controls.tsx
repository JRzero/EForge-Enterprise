import {Button as EForgeButton, Input as EForgeInput} from '@eforge/ui';
import type {ComponentPropsWithRef} from 'react';

/** Public product controls, backed by the pinned EForge dependency. */
export * from '@eforge/ui';
export type ButtonProps = ComponentPropsWithRef<typeof EForgeButton>;
export type InputProps = ComponentPropsWithRef<typeof EForgeInput>;
export function Button(props: ButtonProps) { return <EForgeButton {...props}/>; }
export function Input(props: InputProps) { return <EForgeInput {...props}/>; }
