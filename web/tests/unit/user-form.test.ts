import {describe, expect, it} from 'vitest';
import {validateUserForm, userDraftKey} from '../../features/users/user-form';
import type {UserWriteRequest} from '../../generated/api';
const valid: UserWriteRequest = {username: 'editor', displayName: '编辑人员', phone: '', email: '', sex: '2', status: '0', roleIds: ['9007199254740993', '2'], postIds: ['3']};
describe('user form boundaries', () => {
  it('identifies individual fields in visual focus order', () => {
    const errors = validateUserForm({...valid, username: 'x', displayName: ' ', phone: 'bad', email: 'bad'}, 'x', true);
    expect(Object.keys(errors)).toEqual(['username', 'displayName', 'password', 'phone', 'email']);
  });
  it('optional contact fields may be cleared and editing never requires a new password', () => {
    expect(validateUserForm(valid, '', false)).toEqual({});
    expect(validateUserForm({...valid, phone: '13900000005', email: 'a@example.com'}, 'Valid12345', true)).toEqual({});
  });
  it('retains the original length and password character constraints', () => {
    for (const invalid of ['1234', 'x'.repeat(21), 'abcde<', 'abcde>', 'abcde"', "abcde'", 'abcde|', 'abcde\\'])
      expect(validateUserForm(valid, invalid, true).password).toBeTruthy();
    expect(validateUserForm({...valid, displayName: 'x'.repeat(31)}, 'Valid12345', true).displayName).toBeTruthy();
  });
  it('reverted content and reordered assignments are not unsaved changes', () => {
    const baseline = userDraftKey(valid, 'original');
    expect(userDraftKey({...valid, roleIds: [...valid.roleIds].reverse()}, 'original')).toBe(baseline);
    expect(userDraftKey({...valid, displayName: '修改'}, 'original')).not.toBe(baseline);
    expect(userDraftKey(valid, 'changed')).not.toBe(baseline);
    expect(valid.roleIds).toEqual(['9007199254740993', '2']);
  });
});
