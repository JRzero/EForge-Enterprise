import {ApiError} from './errors';
import type {CustomOutputResult, Creation} from '../generated/api';

/** Retained file outcomes must be reviewed before an explicit overwrite retry. */
export class GeneratorCustomOutputError extends ApiError {
  constructor(readonly output: CustomOutputResult) {super(503, 'GENERATOR_CUSTOM_OUTPUT_PARTIAL');}
}
/** Physical DDL outcomes survive failed metadata import and must remain visible. */
export class GeneratorCreationError extends ApiError {
  constructor(status: number, code: string, readonly creation: Creation) {super(status, code);}
}