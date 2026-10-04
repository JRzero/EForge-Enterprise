import {bootstrap, login, listPosts, getPost, createPost, updatePost, deletePosts, exportPosts,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, sortDepartments,
  type DepartmentRequest, type DepartmentSortRequest, type PostRequest, type LoginRequestWrite, type UserSummary} from '../generated/api';
import type {AuthStore} from '@eforge/core';
import {ApiError, record} from './errors';
import {listUsers, listUserDepartments, getUserOptions, getUser, createUser, updateUser, deleteUsers,
  setUserStatus, resetUserPassword, getUserRoles, setUserRoles, exportUsers, importUsers, downloadUserImportTemplate,
  type UserWriteRequest, type CreateUserRequestWrite} from '../generated/api';
import {getCaptcha, revokeSession} from './legacy-auth';
import {getMyProfile, updateMyProfile, changeMyPassword, uploadMyAvatar,
  type UpdateProfileRequest, type ChangePasswordRequestWrite} from '../generated/api';
import {listRoles, getRole, getRoleOptions, getRoleMenuOptions, getRoleDepartmentOptions,
  createRole, updateRole, deleteRoles, setRoleStatus, getRoleDataScope, setRoleDataScope,
  listRoleUsers, assignRoleUsers, cancelRoleUsers, exportRoles,
  type RoleWriteRequest, type RoleScopeRequest} from '../generated/api';
import {listMenus, getMenu, getMenuOptions, getMenuRouteOptions, createMenu, updateMenu, deleteMenu, sortMenus,
  type MenuWriteRequest, type MenuSortRequest} from '../generated/api';
import {listDictionaries, getDictionary, getDictionaryOptions, getDictionaryValues, createDictionary,
  updateDictionary, deleteDictionaries, refreshDictionaryCache, exportDictionaries,
  listDictionaryEntries, getDictionaryEntry, createDictionaryEntry, updateDictionaryEntry,
  deleteDictionaryEntries, exportDictionaryEntries, type DictionaryRequest, type EntryRequest} from '../generated/api';
import {listConfigurations, getConfiguration, getConfigurationValue, createConfiguration, updateConfiguration,
  deleteConfigurations, refreshConfigurationCache, exportConfigurations, type ConfigurationRequest} from '../generated/api';
import {listNotices, getNotice, createNotice, updateNotice, deleteNotices, getNoticeFeed,
  markNoticesRead, listNoticeReaders, uploadNoticeImage, type NoticeRequest} from '../generated/api';
import {listOperationLogs, getOperationLog, deleteOperationLogs, clearOperationLogs, exportOperationLogs,
  listLoginLogs, deleteLoginLogs, clearLoginLogs, exportLoginLogs, unlockLoginAccount} from '../generated/api';

export function createApi(auth: AuthStore<UserSummary>, fetcher: typeof fetch = fetch,
  onUnauthorized: (token: string) => void = () => {}) {
  function transport(authenticated: boolean, timeoutMs = 15000): typeof fetch {
    return async (input, init) => {
      const token = authenticated ? auth.getState().session?.accessToken : undefined;
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await fetcher(input, {...init, headers, signal, cache: 'no-store', credentials: 'omit'});
      if (!response.ok) {
        const body = record(await response.clone().json().catch(() => ({})));
        if (response.status === 401 && token) onUnauthorized(token);
        throw new ApiError(response.status, typeof body.code === 'string' ? body.code : 'HTTP_ERROR');
      }
      return response;
    };
  }
  return {
    async listOperationLogs(query: Parameters<typeof listOperationLogs>[0], signal?: AbortSignal) {
      return (await listOperationLogs(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getOperationLog(id: string, signal?: AbortSignal) {
      return (await getOperationLog(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async deleteOperationLogs(ids: string[]) {
      await deleteOperationLogs({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async clearOperationLogs() {
      await clearOperationLogs({baseUrl: '', fetch: transport(true)});
    },
    async exportOperationLogs(query: Parameters<typeof exportOperationLogs>[0]) {
      return (await exportOperationLogs(query, {baseUrl: '', fetch: transport(true, 120000)})).data;
    },
    async listLoginLogs(query: Parameters<typeof listLoginLogs>[0], signal?: AbortSignal) {
      return (await listLoginLogs(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async deleteLoginLogs(ids: string[]) {
      await deleteLoginLogs({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async clearLoginLogs() {
      await clearLoginLogs({baseUrl: '', fetch: transport(true)});
    },
    async exportLoginLogs(query: Parameters<typeof exportLoginLogs>[0]) {
      return (await exportLoginLogs(query, {baseUrl: '', fetch: transport(true, 120000)})).data;
    },
    async unlockLoginAccount(username: string) {
      await unlockLoginAccount({username}, {baseUrl: '', fetch: transport(true)});
    },
    async listNotices(query: Parameters<typeof listNotices>[0], signal?: AbortSignal) {
      return (await listNotices(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getNotice(id: string, signal?: AbortSignal) {
      return (await getNotice(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createNotice(request: NoticeRequest) {
      return (await createNotice(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateNotice(id: string, request: NoticeRequest) {
      await updateNotice(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteNotices(ids: string[]) {
      await deleteNotices({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async getNoticeFeed(signal?: AbortSignal) {
      return (await getNoticeFeed({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async markNoticesRead(ids: string[], signal?: AbortSignal) {
      await markNoticesRead({ids}, {baseUrl: '', fetch: transport(true), signal});
    },
    async uploadNoticeImage(file: File, signal?: AbortSignal) {
      return (await uploadNoticeImage({file}, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async listNoticeReaders(id: string, query: Parameters<typeof listNoticeReaders>[1], signal?: AbortSignal) {
      return (await listNoticeReaders(id, query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async listConfigurations(query: Parameters<typeof listConfigurations>[0], signal?: AbortSignal) {
      return (await listConfigurations(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getConfiguration(id: string, signal?: AbortSignal) {
      return (await getConfiguration(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getConfigurationValue(key: string, signal?: AbortSignal) {
      return (await getConfigurationValue(key, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createConfiguration(request: ConfigurationRequest) {
      return (await createConfiguration(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateConfiguration(id: string, request: ConfigurationRequest) {
      await updateConfiguration(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteConfigurations(ids: string[]) {
      await deleteConfigurations({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async refreshConfigurationCache() {
      await refreshConfigurationCache({baseUrl: '', fetch: transport(true)});
    },
    async exportConfigurations(query: Parameters<typeof exportConfigurations>[0]) {
      return (await exportConfigurations(query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async listDictionaries(query: Parameters<typeof listDictionaries>[0], signal?: AbortSignal) {
      return (await listDictionaries(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getDictionary(id: string, signal?: AbortSignal) {
      return (await getDictionary(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getDictionaryOptions(signal?: AbortSignal) {
      return (await getDictionaryOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getDictionaryValues(code: string, signal?: AbortSignal) {
      return (await getDictionaryValues(code, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createDictionary(request: DictionaryRequest) {
      return (await createDictionary(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateDictionary(id: string, request: DictionaryRequest) {
      await updateDictionary(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteDictionaries(ids: string[]) {
      await deleteDictionaries({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async refreshDictionaryCache() {
      await refreshDictionaryCache({baseUrl: '', fetch: transport(true)});
    },
    async exportDictionaries(query: Parameters<typeof exportDictionaries>[0]) {
      return (await exportDictionaries(query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async listDictionaryEntries(id: string, query: Parameters<typeof listDictionaryEntries>[1], signal?: AbortSignal) {
      return (await listDictionaryEntries(id, query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getDictionaryEntry(id: string, signal?: AbortSignal) {
      return (await getDictionaryEntry(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createDictionaryEntry(request: EntryRequest) {
      return (await createDictionaryEntry(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateDictionaryEntry(id: string, request: EntryRequest) {
      await updateDictionaryEntry(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteDictionaryEntries(ids: string[]) {
      await deleteDictionaryEntries({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async exportDictionaryEntries(id: string, query: Parameters<typeof exportDictionaryEntries>[1]) {
      return (await exportDictionaryEntries(id, query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async listMenus(query: Parameters<typeof listMenus>[0], signal?: AbortSignal) {
      return (await listMenus(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getMenu(id: string, signal?: AbortSignal) {
      return (await getMenu(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getMenuOptions(signal?: AbortSignal, excludeId?: string) {
      return (await getMenuOptions({excludeId}, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getMenuRouteOptions(signal?: AbortSignal) {
      return (await getMenuRouteOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createMenu(request: MenuWriteRequest) {
      return (await createMenu(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateMenu(id: string, request: MenuWriteRequest) {
      await updateMenu(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteMenu(id: string) {
      await deleteMenu(id, {baseUrl: '', fetch: transport(true)});
    },
    async sortMenus(request: MenuSortRequest) {
      await sortMenus(request, {baseUrl: '', fetch: transport(true)});
    },
    async listRoles(query: Parameters<typeof listRoles>[0], signal?: AbortSignal) {
      return (await listRoles(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getRole(id: string, signal?: AbortSignal) {
      return (await getRole(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getRoleOptions(signal?: AbortSignal) {
      return (await getRoleOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getRoleMenuOptions(signal?: AbortSignal) {
      return (await getRoleMenuOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getRoleDepartmentOptions(signal?: AbortSignal) {
      return (await getRoleDepartmentOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createRole(request: RoleWriteRequest) {
      return (await createRole(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateRole(id: string, request: RoleWriteRequest) {
      await updateRole(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async deleteRoles(ids: string[]) {
      await deleteRoles({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async setRoleStatus(id: string, status: string) {
      await setRoleStatus(id, {status}, {baseUrl: '', fetch: transport(true)});
    },
    async getRoleDataScope(id: string, signal?: AbortSignal) {
      return (await getRoleDataScope(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async setRoleDataScope(id: string, request: RoleScopeRequest) {
      await setRoleDataScope(id, request, {baseUrl: '', fetch: transport(true)});
    },
    async listRoleUsers(id: string, query: Parameters<typeof listRoleUsers>[1], signal?: AbortSignal) {
      return (await listRoleUsers(id, query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async assignRoleUsers(id: string, userIds: string[]) {
      await assignRoleUsers(id, {userIds}, {baseUrl: '', fetch: transport(true)});
    },
    async cancelRoleUsers(id: string, userIds: string[]) {
      await cancelRoleUsers(id, {userIds}, {baseUrl: '', fetch: transport(true)});
    },
    async exportRoles(query: Parameters<typeof exportRoles>[0]) {
      return (await exportRoles(query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async getMyProfile(signal?: AbortSignal) {
      return (await getMyProfile({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async updateMyProfile(request: UpdateProfileRequest) {
      await updateMyProfile(request, {baseUrl: '', fetch: transport(true)});
    },
    async changeMyPassword(request: ChangePasswordRequestWrite) {
      await changeMyPassword(request, {baseUrl: '', fetch: transport(true)});
    },
    async uploadMyAvatar(file: File) {
      return (await uploadMyAvatar({file}, {baseUrl: '', fetch: transport(true)})).data;
    },
    async importUsers(file: File, updateExisting: boolean) {
      return (await importUsers({file}, {updateExisting}, {baseUrl: '', fetch: transport(true, 600000)})).data;
    },
    async downloadUserImportTemplate() {
      return (await downloadUserImportTemplate({baseUrl: '', fetch: transport(true)})).data;
    },
    async listUsers(query: Parameters<typeof listUsers>[0], signal?: AbortSignal) {
      return (await listUsers(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async listUserDepartments(signal?: AbortSignal) {
      return (await listUserDepartments({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getUserOptions(signal?: AbortSignal) {
      return (await getUserOptions({baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getUser(id: string, signal?: AbortSignal) {
      return (await getUser(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createUser(request: CreateUserRequestWrite) {
      return (await createUser(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateUser(id: string, request: UserWriteRequest) {
      return (await updateUser(id, request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async deleteUsers(ids: string[]) {
      await deleteUsers({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async setUserStatus(id: string, status: string) {
      await setUserStatus(id, {status}, {baseUrl: '', fetch: transport(true)});
    },
    async resetUserPassword(id: string, password: string) {
      await resetUserPassword(id, {password}, {baseUrl: '', fetch: transport(true)});
    },
    async getUserRoles(id: string, signal?: AbortSignal) {
      return (await getUserRoles(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async setUserRoles(id: string, roleIds: string[]) {
      await setUserRoles(id, {roleIds}, {baseUrl: '', fetch: transport(true)});
    },
    async exportUsers(query: Parameters<typeof exportUsers>[0]) {
      return (await exportUsers(query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async listDepartments(query: Parameters<typeof listDepartments>[0], signal?: AbortSignal) {
      return (await listDepartments(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getDepartment(id: string, signal?: AbortSignal) {
      return (await getDepartment(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createDepartment(request: DepartmentRequest) {
      return (await createDepartment(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updateDepartment(id: string, request: DepartmentRequest) {
      return (await updateDepartment(id, request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async deleteDepartment(id: string) {
      await deleteDepartment(id, {baseUrl: '', fetch: transport(true)});
    },
    async sortDepartments(request: DepartmentSortRequest) {
      await sortDepartments(request, {baseUrl: '', fetch: transport(true)});
    },
    async listPosts(query: Parameters<typeof listPosts>[0], signal?: AbortSignal) {
      return (await listPosts(query, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async getPost(id: string, signal?: AbortSignal) {
      return (await getPost(id, {baseUrl: '', fetch: transport(true), signal})).data;
    },
    async createPost(request: PostRequest) {
      return (await createPost(request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async updatePost(id: string, request: PostRequest) {
      return (await updatePost(id, request, {baseUrl: '', fetch: transport(true)})).data;
    },
    async deletePosts(ids: string[]) {
      await deletePosts({ids}, {baseUrl: '', fetch: transport(true)});
    },
    async exportPosts(query: Parameters<typeof exportPosts>[0]) {
      return (await exportPosts(query, {baseUrl: '', fetch: transport(true)})).data;
    },
    async login(request: LoginRequestWrite, signal?: AbortSignal) {
      const response = await login(request, {baseUrl: '', fetch: transport(false), signal});
      if (response.status !== 200 || !response.data.accessToken || response.data.tokenType !== 'Bearer') {
        throw new ApiError(503, 'INVALID_LOGIN_RESPONSE');
      }
      return response.data;
    },
    async bootstrap(signal?: AbortSignal) {
      const response = await bootstrap({baseUrl: '', fetch: transport(true), signal});
      const snapshot = response.data;
      if (!snapshot?.user?.id || !Array.isArray(snapshot.permissions) || !Array.isArray(snapshot.roles) ||
          !Array.isArray(snapshot.navigation) || snapshot.permissions.some(value => typeof value !== 'string')) {
        throw new ApiError(503, 'INVALID_BOOTSTRAP_RESPONSE');
      }
      return snapshot;
    },
    captcha: (signal?: AbortSignal) => getCaptcha(transport(false), signal),
    logout: (signal?: AbortSignal) => revokeSession(transport(true), signal)
  };
}
export type ApplicationApi = ReturnType<typeof createApi>;
