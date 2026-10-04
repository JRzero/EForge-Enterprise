export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(messageFor(status, code));
  }
}
function messageFor(status: number, code: string): string {
  if (code === 'DEPARTMENT_NOT_FOUND') return '部门已不存在，请刷新后重试。';
  if (code === 'DEPARTMENT_NAME_EXISTS') return '该上级部门下已存在同名部门。';
  if (code === 'DEPARTMENT_PARENT_INVALID') return '请选择有效的上级部门。';
  if (code === 'DEPARTMENT_PARENT_DISABLED') return '上级部门已停用，无法新增子部门。';
  if (code === 'DEPARTMENT_CYCLE') return '上级部门不能是当前部门或其下级部门。';
  if (code === 'DEPARTMENT_ACTIVE_CHILDREN') return '该部门包含正常状态的下级部门，无法停用。';
  if (code === 'DEPARTMENT_HAS_CHILDREN') return '该部门仍有下级部门，无法删除。';
  if (code === 'DEPARTMENT_HAS_USERS') return '该部门仍有用户，无法删除。';
  if (code === 'DEPARTMENT_ROOT_PROTECTED') return '组织根部门无法删除。';
  if (code === 'DEPARTMENT_ROOT_MISSING') return '组织结构暂时无法修改，请联系管理员。';
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
