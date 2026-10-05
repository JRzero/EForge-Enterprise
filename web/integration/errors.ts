export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(messageFor(status, code));
  }
}
function messageFor(status: number, code: string): string {
  if (code === 'OPERATION_LOG_NOT_FOUND') return '日志已不存在，请刷新后重试。';
  if (code === 'LOGIN_UNLOCK_UNAVAILABLE') return '账号解锁暂时未能完成，请稍后重试。';
  if (code === 'NOTICE_NOT_FOUND') return '公告已不存在，请刷新后重试。';
  if (code === 'NOTICE_IMAGE_INVALID') return '请选择小于 5 MB 的有效 JPG、PNG 或静态 SVG 图片。';
  if (code === 'NOTICE_IMAGE_STORAGE_UNAVAILABLE') return '图片暂时无法保存，请稍后重试。';
  if (code === 'CONFIGURATION_NOT_FOUND') return '参数已不存在，请刷新后重试。';
  if (code === 'CONFIGURATION_KEY_EXISTS') return '参数键名已存在，请使用其他键名。';
  if (code === 'CONFIGURATION_BUILTIN') return '内置参数不能删除，请重新选择。';
  if (code === 'CONFIGURATION_CACHE_UNAVAILABLE') return '参数缓存暂时不可用，请稍后重试。';
  if (code === 'DICTIONARY_NOT_FOUND') return '字典类型已不存在，请刷新后重试。';
  if (code === 'DICTIONARY_ENTRY_NOT_FOUND') return '字典数据已不存在，请刷新后重试。';
  if (code === 'DICTIONARY_CODE_EXISTS') return '字典类型标识已存在，请使用其他标识。';
  if (code === 'DICTIONARY_HAS_ENTRIES') return '该字典包含数据，请先删除数据再删除类型。';
  if (code === 'DICTIONARY_ORPHAN_ENTRY') return '该数据的字典类型已不存在，请刷新后重试。';
  if (code === 'DICTIONARY_CACHE_UNAVAILABLE') return '字典缓存暂时不可用，请稍后重试。';
  if (code === 'MENU_NOT_FOUND') return '菜单已不存在，请刷新后重试。';
  if (code === 'MENU_KEY_IMMUTABLE') return '已有菜单的稳定标识不能修改。';
  if (code === 'MENU_KEY_EXISTS') return '菜单标识已存在，请使用其他标识。';
  if (code === 'MENU_NAME_EXISTS') return '该上级菜单下已存在同名菜单。';
  if (code === 'MENU_ROUTE_EXISTS') return '所选页面已关联其他菜单。';
  if (code === 'MENU_PATH_EXISTS') return '目录地址已存在，请使用其他地址。';
  if (code === 'MENU_HAS_CHILDREN') return '该菜单包含子菜单，不能删除或改为按钮、外链。';
  if (code === 'MENU_IN_USE') return '该菜单已分配给角色，请先取消授权。';
  if (code === 'MENU_CYCLE') return '上级菜单不能是当前菜单或其下级，且层级不能超过 64 层。';
  if (code === 'MENU_IDENTITY_EXISTS') return '菜单名称或标识已存在，请修改后重试。';
  if (code === 'MENU_WRITE_CONFLICT') return '菜单状态已变化，请刷新后重试。';
  if (code === 'ROLE_NOT_FOUND') return '角色已不存在，请刷新后重试。';
  if (code === 'ROLE_NAME_EXISTS') return '角色名称已存在，请使用其他名称。';
  if (code === 'ROLE_KEY_EXISTS') return '角色权限字符已存在，请使用其他字符。';
  if (code === 'ROLE_CONFLICT') return '角色名称或权限字符已存在，请修改后重试。';
  if (code === 'ROLE_ADMIN_PROTECTED') return '超级管理员角色不能修改。';
  if (code === 'ROLE_IN_USE') return '该角色已分配给用户，请先取消授权。';
  if (code === 'ROLE_DISABLED') return '该角色已停用，不能新增用户授权。';
  if (code === 'ROLE_MENU_NOT_FOUND') return '所选菜单已不存在，请重新选择。';
  if (code === 'ROLE_DEPARTMENT_NOT_FOUND') return '所选部门已不存在，请重新选择。';
  if (code === 'ROLE_WRITE_CONFLICT') return '角色状态已变更，请刷新后重试。';
  if (code === 'OLD_PASSWORD_INVALID') return '旧密码不正确，请重新输入。';
  if (code === 'PASSWORD_UNCHANGED') return '新密码不能与旧密码相同。';
  if (code === 'PROFILE_WRITE_CONFLICT') return '个人资料未能保存，请刷新后重试。';
  if (code === 'AVATAR_INVALID') return '请选择有效的 JPG、PNG、GIF 或 BMP 图片，大小不超过 10 MB，每边不超过 4096 像素。';
  if (code === 'AVATAR_STORAGE_UNAVAILABLE') return '头像暂时无法保存，请稍后重试。';
  if (code === 'USER_IMPORT_FILE_INVALID') return '请选择有效的 XLS 或 XLSX 用户表格，并保留模板的登录名称列。';
  if (code === 'USER_IMPORT_TOO_LARGE') return '一次最多导入 1000 条数据，请拆分表格后重试。';
  if (code === 'USER_IMPORT_EMPTY') return '表格没有用户数据，请填写后重试。';
  if (code === 'USER_IMPORT_FAILED') return '该条用户数据未能保存，请检查后重试。';
  if (code === 'USER_INITIAL_PASSWORD_INVALID') return '初始密码配置无效，请联系管理员。';
  if (code === 'ACCESS_DENIED') return '当前账号没有操作权限。';
  if (code === 'USER_NOT_FOUND') return '用户已不存在，请刷新后重试。';
  if (code === 'USER_USERNAME_EXISTS') return '登录账号已存在，请使用其他账号。';
  if (code === 'USER_PHONE_EXISTS') return '手机号码已被其他账号使用。';
  if (code === 'USER_EMAIL_EXISTS') return '邮箱已被其他账号使用。';
  if (code === 'USER_CONFLICT') return '登录账号、手机或邮箱已存在，请修改后重试。';
  if (code === 'USER_USERNAME_IMMUTABLE') return '已有用户的登录账号不能修改。';
  if (code === 'USER_ADMIN_PROTECTED') return '超级管理员账号不能修改。';
  if (code === 'USER_SELF_DELETE') return '不能删除当前登录用户。';
  if (code === 'USER_ADMIN_ROLE_PROTECTED') return '不能为普通用户分配超级管理员角色。';
  if (code === 'USER_DEPARTMENT_NOT_FOUND') return '所选部门已不存在，请重新选择。';
  if (code === 'USER_DEPARTMENT_DISABLED') return '所选部门已停用，不能新增分配。';
  if (code === 'USER_ROLE_NOT_FOUND') return '所选角色已不存在，请重新选择。';
  if (code === 'USER_ROLE_DISABLED') return '所选角色已停用，不能新增分配。';
  if (code === 'USER_POST_NOT_FOUND') return '所选岗位已不存在，请重新选择。';
  if (code === 'USER_POST_DISABLED') return '所选岗位已停用，不能新增分配。';
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
  if (code === 'ONLINE_SESSIONS_UNAVAILABLE') return '在线会话暂时无法读取或撤销，请稍后重试。';
  if (code === 'SERVER_MONITOR_UNAVAILABLE') return '服务器监控暂时无法采集，请稍后重试。';
  if (code === 'CACHE_UNAVAILABLE') return '缓存服务暂时不可用，请稍后重试。';
  if (code === 'CACHE_KEY_NOT_FOUND') return '缓存键已过期或已被清理，请刷新键列表。';
  if (code === 'INVALID_CACHE_NAME' || code === 'INVALID_CACHE_KEY') return '缓存名称或键不属于所选缓存，请刷新后重试。';
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
