import {expect, it} from 'vitest';
import {parseCron, cronExpression, replaceCronField, cronToken} from '../../features/jobs/cron-model';
it('six/seven fields preserve named and uncommon valid Quartz syntax until edited', () => {
  for (const expression of ['0 0 0 L * ?', '0 0/5 8-18 ? JAN,MAR MON-FRI 2099', '0 0 0 L-3 * ?', '0 0 0 ? * 6#5', '0 0 0 LW * ?']) expect(cronExpression(parseCron(expression)!)).toBe(expression);
  expect(parseCron('0 0')).toBeNull(); expect(parseCron('0 0 0 1 1 ? 2099 extra')).toBeNull();
});
it('calendar edits make day and week mutually exclusive without rewriting other fields', () => {
  let fields = parseCron('0 15 9 10 JAN ? 2099')!;
  fields = replaceCronField(fields, 5, {...fields[5]!, mode: 'nth', start: 6, ordinal: 5}); expect(cronExpression(fields)).toBe('0 15 9 ? JAN 6#5 2099');
  fields = replaceCronField(fields, 3, {...fields[3]!, mode: 'nearest', start: 31}); expect(cronExpression(fields)).toBe('0 15 9 31W JAN ? 2099');
  fields = replaceCronField(fields, 3, {...fields[3]!, mode: 'none'}); expect(cronExpression(fields)).toBe('0 15 9 ? JAN * 2099');
});
it('numeric boundaries reject empty selections, fractions, NaN and invalid intervals', () => {
  const fields = parseCron('* * * * * ?')!;
  expect(() => cronToken({...fields[0]!, mode: 'list', values: []}, 0)).toThrow('至少');
  for (const start of [-1, 60, 1.5, NaN]) expect(() => cronToken({...fields[0]!, mode: 'step', start}, 0)).toThrow('整数');
  expect(() => cronToken({...fields[0]!, mode: 'step', interval: 0}, 0)).toThrow();
  expect(() => cronToken({...fields[5]!, mode: 'nth', ordinal: 6}, 5)).toThrow();
  expect(() => cronToken({...fields[2]!, mode: 'range', start: 10, end: 2}, 2)).toThrow('大于');
  expect(cronToken({...fields[5]!, mode: 'range', start: 6, end: 2}, 5)).toBe('6-2');
});
it('year omission/expired years and sorted distinct specified values remain representable', () => {
  const fields = parseCron('0 0 0 1 1 ? 1970')!; expect(cronExpression(fields)).toBe('0 0 0 1 1 ? 1970');
  expect(cronToken({...fields[6]!, mode: 'omit'}, 6)).toBe('');
  expect(cronToken({...fields[0]!, mode: 'list', values: [59, 1, 1, 0]}, 0)).toBe('0,1,59');
  expect(cronToken({...fields[5]!, mode: 'weekdayLast', start: 7}, 5)).toBe('7L');
});
