import {bootstrap, login, listPosts, getPost, createPost, updatePost, deletePosts, exportPosts,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, sortDepartments,
  type DepartmentRequest, type DepartmentSortRequest, type PostRequest, type LoginRequestWrite, type UserSummary} from '../generated/api';
import type {AuthStore} from '@eforge/core';
import {ApiError, record} from './errors';
import {listUsers, listUserDepartments, getUserOptions, getUser, createUser, updateUser, deleteUsers,
  setUserStatus, resetUserPassword, getUserRoles, setUserRoles, exportUsers,
  type UserWriteRequest, type CreateUserRequestWrite} from '../generated/api';
import {getCaptcha, revokeSession} from './legacy-auth';

export function createApi(auth: AuthStore<UserSummary>, fetcher: typeof fetch = fetch,
  onUnauthorized: (token: string) => void = () => {}) {
  function transport(authenticated: boolean): typeof fetch {
    return async (input, init) => {
      const token = authenticated ? auth.getState().session?.accessToken : undefined;
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const timeout = AbortSignal.timeout(15000);
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
