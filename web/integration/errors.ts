export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(messageFor(status, code));
  }
}
function messageFor(status: number, code: string): string {
  if (code === 'POST_CODE_EXISTS') return '岗位编码已存在，请使用其他编码。';
  if (code === 'POST_NAME_EXISTS') return '岗位名称已存在，请使用其他名称。';
  if (code === 'POST_CONFLICT') return '岗位编码或名称已存在，请修改后重试。';
  if (code === 'POST_IN_USE') return '该岗位已分配给用户，无法删除。';
  if (code === 'POST_NOT_FOUND') return '岗位已不存在，请刷新列表后重试。';
  if (code === 'CAPTCHA_INVALID') return '验证码不正确或已过期，请重新输入。';
  if (code === 'AUTHENTICATION_FAILED') return '账号或密码不正确，或账号暂时无法登录。';
  if (code === 'VALIDATION_ERROR') return '请检查填写内容后重试。';
  if (status === 401) return '登录已过期，请重新登录。';
  if (status === 403) return '当前账号没有操作权限。';
  return '服务暂时不可用，请稍后重试。';
}
export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : '连接失败，请检查网络后重试。';
}
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
