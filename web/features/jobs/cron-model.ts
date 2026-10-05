export const cronFields = [
  {label: '秒', min: 0, max: 59}, {label: '分钟', min: 0, max: 59}, {label: '小时', min: 0, max: 23},
  {label: '日', min: 1, max: 31}, {label: '月', min: 1, max: 12}, {label: '周', min: 1, max: 7}, {label: '年', min: 1970, max: 2099}
] as const;
export type CronMode = 'every' | 'none' | 'omit' | 'range' | 'step' | 'list' | 'nearest' | 'last' | 'weekdayLast' | 'nth' | 'custom';
export type CronField = {mode: CronMode; start: number; end: number; interval: number; ordinal: number; values: number[]; raw: string};
export const defaultCron = '* * * * * ?';
export function parseCron(value: string): CronField[] | null {
  const parts = value.trim().split(/\s+/); if (parts.length !== 6 && parts.length !== 7) return null;
  if (parts.length === 6) parts.push('');
  return parts.map((raw, index) => {
    const bounds = cronFields[index]!;
    const field: CronField = {mode: 'custom', start: bounds.min, end: bounds.min + 1, interval: 1, ordinal: 1, values: [bounds.min], raw};
    if (raw === '*') field.mode = 'every'; else if (raw === '?' && (index === 3 || index === 5)) field.mode = 'none'; else if (!raw && index === 6) field.mode = 'omit';
    else if (/^\d+-\d+$/.test(raw)) {field.mode = 'range'; [field.start, field.end] = raw.split('-').map(Number) as [number, number];}
    else if (/^\d+\/\d+$/.test(raw)) {field.mode = 'step'; [field.start, field.interval] = raw.split('/').map(Number) as [number, number];}
    else if (/^\d+(,\d+)*$/.test(raw)) {field.mode = 'list'; field.values = raw.split(',').map(Number);}
    else if (index === 3 && /^\d+W$/.test(raw)) {field.mode = 'nearest'; field.start = Number(raw.slice(0, -1));}
    else if (index === 3 && raw === 'L') field.mode = 'last';
    else if (index === 5 && /^\dL$/.test(raw)) {field.mode = 'weekdayLast'; field.start = Number(raw[0]);}
    else if (index === 5 && /^\d#[1-5]$/.test(raw)) {field.mode = 'nth'; [field.start, field.ordinal] = raw.split('#').map(Number) as [number, number];}
    return field;
  });
}
export function cronToken(field: CronField, index: number): string {
  const {min, max, label} = cronFields[index]!;
  const check = (value: number, lower: number = min, upper: number = max) => {if (!Number.isInteger(value) || value < lower || value > upper) throw new Error(`${label}取值须为 ${lower} 到 ${upper} 的整数。`); return value;};
  switch (field.mode) {
    case 'every': return '*';
    case 'none': if (index !== 3 && index !== 5) throw new Error('只有日和周可不指定。'); return '?';
    case 'omit': if (index !== 6) throw new Error('只有年可省略。'); return '';
    case 'range': check(field.start); check(field.end); if (index !== 5 && field.start >= field.end) throw new Error(`${label}区间结束值须大于开始值。`); return `${field.start}-${field.end}`;
    case 'step': return `${check(field.start)}/${check(field.interval, 1, max - min + 1)}`;
    case 'list': if (!field.values.length) throw new Error(`请至少指定一个${label}取值。`); field.values.forEach(value => check(value)); return [...new Set(field.values)].sort((a, b) => a - b).join(',');
    case 'nearest': if (index !== 3) throw new Error('工作日仅适用于日。'); return `${check(field.start)}W`;
    case 'last': if (index !== 3) throw new Error('月末仅适用于日。'); return 'L';
    case 'weekdayLast': if (index !== 5) throw new Error('最后一个星期仅适用于周。'); return `${check(field.start)}L`;
    case 'nth': if (index !== 5) throw new Error('第几个星期仅适用于周。'); return `${check(field.start)}#${check(field.ordinal, 1, 5)}`;
    case 'custom': if (!field.raw || /\s/.test(field.raw)) throw new Error(`${label}字段不可为空或含空白。`); return field.raw;
  }
}
export function cronExpression(fields: CronField[]): string {return fields.map(cronToken).join(' ').trim();}
/** Structured date edits keep Quartz's day-of-month/day-of-week mutual exclusion. */
export function replaceCronField(fields: CronField[], index: number, field: CronField): CronField[] {
  const next = fields.map((entry, i) => i === index ? field : entry);
  if (index === 3 || index === 5) {
    const other = index === 3 ? 5 : 3;
    if (field.mode !== 'none') next[other] = {...next[other]!, mode: 'none'};
    else if (next[other]!.mode === 'none') next[other] = {...next[other]!, mode: 'every'};
  }
  return next;
}
