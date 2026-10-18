import {describe,it,expect} from 'vitest';
import {exactNumberIssue,normalizeNumberPaste} from '../../ui/exact-number';
describe('exact number rules',()=>{
  it('compares beyond float precision without rounding and keeps empty distinct',()=>{
    expect(exactNumberIssue('9007199254740993.0101',{max:'9007199254740993.0100'})).not.toBe('');
    expect(exactNumberIssue('9007199254740993.0100',{min:'9007199254740993.0100',max:'9007199254740993.0100'})).toBe('');
    expect(exactNumberIssue('-0.00000000000000001',{min:'0'})).not.toBe('');
    expect(exactNumberIssue('',{min:'1'})).toBe('');expect(exactNumberIssue('0',{min:'1'})).not.toBe('');
  });
  it('supports exact exponent values without allocating exponent-sized strings',()=>{
    expect(exactNumberIssue('1e1000000',{max:'9e999999'})).not.toBe('');
    expect(exactNumberIssue('-1e1000000',{max:'-9e999999'})).toBe('');
    expect(exactNumberIssue('1.2300',{scale:2})).toBe('');expect(exactNumberIssue('1.231',{scale:2})).not.toBe('');
    expect(exactNumberIssue('1e-3',{scale:2})).not.toBe('');expect(exactNumberIssue('12e1',{integer:true})).not.toBe('');
  });
  it('rejects malformed drafts and ambiguous separators while preserving exact paste digits',()=>{
    for(const value of ['-','.','1e','Infinity','NaN','0x10','1,23','1 2'])expect(exactNumberIssue(value)).not.toBe('');
    expect(normalizeNumberPaste(' 9,007,199,254,740,993.0100 ')).toBe('9007199254740993.0100');
    expect(normalizeNumberPaste('1,23')).toBe('1,23');expect(normalizeNumberPaste('1.234,56')).toBe('1.234,56');
  });
});
