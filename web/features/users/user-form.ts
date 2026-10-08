import type {UserWriteRequest} from '../../generated/api';

export type UserFormField = 'username' | 'displayName' | 'password' | 'phone' | 'email';
export type UserFormErrors = Partial<Record<UserFormField, string>>;
export function validateUserForm(form: UserWriteRequest, password: string, creating: boolean): UserFormErrors {
  const errors: UserFormErrors = {};
  if (form.username.length < 2 || form.username.length > 20) errors.username = '账号须为 2–20 个字符。';
  if (!form.displayName.trim() || form.displayName.length > 30) errors.displayName = '请填写不超过 30 个字符的用户昵称。';
  if (creating && (password.length < 5 || password.length > 20 || /[<>"'|\\]/.test(password))) errors.password = '密码须为 5–20 个字符，且不能包含非法符号。';
  if (form.phone && !/^1[3-9][0-9]{9}$/.test(form.phone)) errors.phone = '请填写有效的 11 位手机号码。';
  if (form.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.email.length > 50)) errors.email = '请填写不超过 50 个字符的有效邮箱。';
  return errors;
}

/** Selection order is not a business change; reverting values should clear the dirty flag. */
export function userDraftKey(form: UserWriteRequest, password: string): string {
  return JSON.stringify([{...form, roleIds: [...form.roleIds].sort(), postIds: [...form.postIds].sort()}, password]);
}
