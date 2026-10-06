import {ApiError} from './errors';
import type {CustomOutputResult} from '../generated/api';

/** Retained file outcomes must be reviewed before an explicit overwrite retry. */
export class GeneratorCustomOutputError extends ApiError {
  constructor(readonly output: CustomOutputResult) {super(503, 'GENERATOR_CUSTOM_OUTPUT_PARTIAL');}
}