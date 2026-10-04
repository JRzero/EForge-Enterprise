/**
 * 标题：若依管理系统_接口文档
 * 版本号:0.1.0
 * DO NOT MODIFY - This file has been generated using oazapfts.
 * See https://www.npmjs.com/package/oazapfts
 */
import * as Oazapfts from "@oazapfts/runtime";
import * as QS from "@oazapfts/runtime/query";
export const defaults: Oazapfts.Defaults<Oazapfts.CustomHeaders> = {
    headers: {},
    baseUrl: "/"
};
const oazapfts = Oazapfts.runtime(defaults);
export const servers = {
    server1: "/"
};
export type NavigationNode = {
    children: NavigationNode[];
    /** Present only for EXTERNAL nodes */
    externalUrl?: string;
    icon?: string;
    key: string;
    label: string;
    order: number;
    /** Present only for ROUTE nodes */
    routeId?: string;
    "type": "GROUP" | "ROUTE" | "EXTERNAL";
};
export type UserSummary = {
    displayName: string;
    id: string;
    username: string;
};
export type BootstrapResponse = {
    navigation: NavigationNode[];
    permissions: string[];
    roles: string[];
    user: UserSummary;
};
export type LoginRequest = {
    code?: string;
    username: string;
    uuid?: string;
};
export type LoginRequestWrite = {
    code?: string;
    password: string;
    username: string;
    uuid?: string;
};
export type LoginResponse = {
    accessToken: string;
    tokenType: string;
};
export type ProblemDetail = {
    detail?: string | null;
    instance?: string | null;
    properties?: {
        [key: string]: unknown;
    } | {
        [key: string]: unknown;
    };
    status?: number;
    title?: string | null;
    "type"?: string;
};
export type ProfileResponse = {
    avatarUrl?: string;
    createdAt?: string;
    departmentName?: string;
    displayName: string;
    email?: string;
    id: string;
    phone?: string;
    postNames: string;
    roleNames: string;
    sex?: string;
    username: string;
};
export type UpdateProfileRequest = {
    displayName: string;
    email: string;
    phone: string;
    sex: string;
};
export type AvatarResponse = {
    avatarUrl: string;
};
export type ChangePasswordRequest = {};
export type ChangePasswordRequestWrite = {
    newPassword: string;
    oldPassword: string;
};
export type DepartmentResponse = {
    createdAt?: string;
    email?: string;
    id: string;
    leader?: string;
    name: string;
    parentId: string;
    phone?: string;
    sort: number;
    status: string;
};
export type DepartmentRequest = {
    email?: string;
    leader?: string;
    name: string;
    parentId: string;
    phone?: string;
    sort: number;
    status: string;
};
export type Item = {
    id: string;
    sort: number;
};
export type DepartmentSortRequest = {
    items: Item[];
};
export type MenuResponse = {
    cached: boolean;
    createdAt?: string;
    externalUrl?: string;
    groupPath?: string;
    icon?: string;
    id: string;
    key?: string;
    name: string;
    parentId: string;
    permission?: string;
    queryText?: string;
    remark?: string;
    routeId?: string;
    sort: number;
    status: string;
    "type": "GROUP" | "ROUTE" | "EXTERNAL" | "FUNCTION";
    visible: boolean;
};
export type MenuWriteRequest = {
    cached: boolean;
    externalUrl?: string;
    groupPath?: string;
    icon?: string;
    key: string;
    name: string;
    parentId: string;
    permission?: string;
    queryText?: string;
    remark?: string;
    routeId?: string;
    sort: number;
    status: string;
    "type": "GROUP" | "ROUTE" | "EXTERNAL" | "FUNCTION";
    visible: boolean;
};
export type MenuRouteOption = {
    id: string;
    path: string;
    permission?: string;
};
export type MenuSortItem = {
    id: string;
    sort: number;
};
export type MenuSortRequest = {
    items: MenuSortItem[];
};
export type DeletePostsRequest = {
    ids: string[];
};
export type PostResponse = {
    code: string;
    createdAt?: string;
    id: string;
    name: string;
    remark?: string;
    sort: number;
    status: string;
};
export type PageResponsePostResponse = {
    items: PostResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type PostRequest = {
    code: string;
    name: string;
    remark?: string;
    sort: number;
    status: string;
};
export type DeleteRolesRequest = {
    ids: string[];
};
export type RoleResponse = {
    createdAt?: string;
    dataScope: string;
    departmentLinked: boolean;
    id: string;
    key: string;
    menuLinked: boolean;
    name: string;
    remark?: string;
    sort: number;
    status: string;
};
export type PageResponseRoleResponse = {
    items: RoleResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type RoleWriteRequest = {
    key: string;
    menuKeys: string[];
    menuLinked: boolean;
    name: string;
    remark?: string;
    sort: number;
    status: string;
};
export type RoleMenuOption = {
    key: string;
    label: string;
    parentKey?: string;
    permission?: string;
    sort: number;
    status: string;
    "type": "M" | "C" | "F";
};
export type RoleEditorResponse = {
    checkedMenuKeys: string[];
    menuKeys: string[];
    role: RoleResponse;
};
export type RoleScopeResponse = {
    checkedDepartmentIds: string[];
    departmentIds: string[];
    departmentLinked: boolean;
    departments: DepartmentResponse[];
    mode: string;
};
export type RoleScopeRequest = {
    departmentIds: string[];
    departmentLinked: boolean;
    mode: string;
};
export type RoleStatusRequest = {
    status: string;
};
export type RoleUsersRequest = {
    userIds: string[];
};
export type UserResponse = {
    createdAt?: string;
    departmentId?: string;
    departmentName?: string;
    displayName: string;
    email?: string;
    id: string;
    phone?: string;
    remark?: string;
    sex?: string;
    status: string;
    username: string;
};
export type PageResponseUserResponse = {
    items: UserResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type DeleteUsersRequest = {
    ids: string[];
};
export type UserWriteRequest = {
    departmentId?: string;
    displayName: string;
    email?: string;
    phone?: string;
    postIds: string[];
    remark?: string;
    roleIds: string[];
    sex: string;
    status: string;
    username: string;
};
export type CreateUserRequest = {
    user: UserWriteRequest;
};
export type CreateUserRequestWrite = {
    password: string;
    user: UserWriteRequest;
};
export type UserImportRow = {
    code?: string;
    outcome: "CREATED" | "UPDATED" | "FAILED";
    /** One-based imported record ordinal */
    row: number;
    username: string;
};
export type UserImportResponse = {
    created: number;
    failed: number;
    rows: UserImportRow[];
    total: number;
    updated: number;
};
export type UserOption = {
    id: string;
    name: string;
    status: string;
};
export type UserOptionsResponse = {
    departments: DepartmentResponse[];
    posts: UserOption[];
    roles: UserOption[];
};
export type UserOptionsResponseRead = {
    departments: DepartmentResponse[];
    initialPassword: string;
    posts: UserOption[];
    roles: UserOption[];
};
export type UserEditorResponse = {
    postIds: string[];
    roleIds: string[];
    user: UserResponse;
};
export type ResetUserPasswordRequest = {};
export type ResetUserPasswordRequestWrite = {
    password: string;
};
export type UserRolesRequest = {
    roleIds: string[];
};
export type UserStatusRequest = {
    status: string;
};
/**
 * Get the current user and authorized application navigation
 */
export function bootstrap(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: BootstrapResponse;
    }>("/api/v1/app/bootstrap", {
        ...opts
    });
}
/**
 * Create a Redis-backed login session
 */
export function login(loginRequest: LoginRequestWrite, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: LoginResponse;
    } | {
        status: 400;
        data: ProblemDetail;
    } | {
        status: 401;
        data: ProblemDetail;
    } | {
        status: 403;
        data: ProblemDetail;
    }>("/api/v1/auth/login", oazapfts.json({
        ...opts,
        method: "POST",
        body: loginRequest
    }));
}
export function getMyProfile(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ProfileResponse;
    }>("/api/v1/me", {
        ...opts
    });
}
export function updateMyProfile(updateProfileRequest: UpdateProfileRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/me", oazapfts.json({
        ...opts,
        method: "PUT",
        body: updateProfileRequest
    }));
}
export function uploadMyAvatar(body?: {
    file: Blob;
}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: AvatarResponse;
    }>("/api/v1/me/avatar", oazapfts.multipart({
        ...opts,
        method: "POST",
        body
    }));
}
export function changeMyPassword(changePasswordRequest: ChangePasswordRequestWrite, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/me/password", oazapfts.json({
        ...opts,
        method: "PUT",
        body: changePasswordRequest
    }));
}
export function listDepartments({ name, status, excludeId }: {
    name?: string;
    status?: string;
    excludeId?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DepartmentResponse[];
    }>(`/api/v1/system/departments${QS.query(QS.explode({
        name,
        status,
        excludeId
    }))}`, {
        ...opts
    });
}
export function createDepartment(departmentRequest: DepartmentRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: DepartmentResponse;
    }>("/api/v1/system/departments", oazapfts.json({
        ...opts,
        method: "POST",
        body: departmentRequest
    }));
}
export function sortDepartments(departmentSortRequest: DepartmentSortRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/departments/sort", oazapfts.json({
        ...opts,
        method: "PUT",
        body: departmentSortRequest
    }));
}
export function deleteDepartment(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/departments/${encodeURIComponent(id)}`, {
        ...opts,
        method: "DELETE"
    });
}
export function getDepartment(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DepartmentResponse;
    }>(`/api/v1/system/departments/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateDepartment(id: string, departmentRequest: DepartmentRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DepartmentResponse;
    }>(`/api/v1/system/departments/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: departmentRequest
    }));
}
export function listMenus({ name, status, visible }: {
    name?: string;
    status?: string;
    visible?: boolean;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuResponse[];
    }>(`/api/v1/system/menus${QS.query(QS.explode({
        name,
        status,
        visible
    }))}`, {
        ...opts
    });
}
export function createMenu(menuWriteRequest: MenuWriteRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuResponse;
    }>("/api/v1/system/menus", oazapfts.json({
        ...opts,
        method: "POST",
        body: menuWriteRequest
    }));
}
export function getMenuOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuResponse[];
    }>("/api/v1/system/menus/options", {
        ...opts
    });
}
export function getMenuRouteOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuRouteOption[];
    }>("/api/v1/system/menus/routes", {
        ...opts
    });
}
export function sortMenus(menuSortRequest: MenuSortRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/menus/sort", oazapfts.json({
        ...opts,
        method: "PUT",
        body: menuSortRequest
    }));
}
export function deleteMenu(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/menus/${encodeURIComponent(id)}`, {
        ...opts,
        method: "DELETE"
    });
}
export function getMenu(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuResponse;
    }>(`/api/v1/system/menus/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateMenu(id: string, menuWriteRequest: MenuWriteRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/menus/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: menuWriteRequest
    }));
}
export function deletePosts(deletePostsRequest: DeletePostsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/posts", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deletePostsRequest
    }));
}
export function listPosts({ page, pageSize, code, name, status }: {
    page?: number;
    pageSize?: number;
    code?: string;
    name?: string;
    status?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponsePostResponse;
    }>(`/api/v1/system/posts${QS.query(QS.explode({
        page,
        pageSize,
        code,
        name,
        status
    }))}`, {
        ...opts
    });
}
export function createPost(postRequest: PostRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: PostResponse;
    }>("/api/v1/system/posts", oazapfts.json({
        ...opts,
        method: "POST",
        body: postRequest
    }));
}
export function exportPosts({ code, name, status }: {
    code?: string;
    name?: string;
    status?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/posts/export${QS.query(QS.explode({
        code,
        name,
        status
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getPost(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PostResponse;
    }>(`/api/v1/system/posts/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updatePost(id: string, postRequest: PostRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PostResponse;
    }>(`/api/v1/system/posts/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: postRequest
    }));
}
export function deleteRoles(deleteRolesRequest: DeleteRolesRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/roles", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteRolesRequest
    }));
}
export function listRoles({ page, pageSize, name, key, status, beginDate, endDate }: {
    page?: number;
    pageSize?: number;
    name?: string;
    key?: string;
    status?: string;
    beginDate?: string;
    endDate?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseRoleResponse;
    }>(`/api/v1/system/roles${QS.query(QS.explode({
        page,
        pageSize,
        name,
        key,
        status,
        beginDate,
        endDate
    }))}`, {
        ...opts
    });
}
export function createRole(roleWriteRequest: RoleWriteRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: RoleResponse;
    }>("/api/v1/system/roles", oazapfts.json({
        ...opts,
        method: "POST",
        body: roleWriteRequest
    }));
}
export function getRoleDepartmentOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DepartmentResponse[];
    }>("/api/v1/system/roles/departments", {
        ...opts
    });
}
export function exportRoles({ name, key, status, beginDate, endDate }: {
    name?: string;
    key?: string;
    status?: string;
    beginDate?: string;
    endDate?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/roles/export${QS.query(QS.explode({
        name,
        key,
        status,
        beginDate,
        endDate
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getRoleMenuOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: RoleMenuOption[];
    }>("/api/v1/system/roles/menus", {
        ...opts
    });
}
export function getRoleOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: RoleResponse[];
    }>("/api/v1/system/roles/options", {
        ...opts
    });
}
export function getRole(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: RoleEditorResponse;
    }>(`/api/v1/system/roles/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateRole(id: string, roleWriteRequest: RoleWriteRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/roles/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: roleWriteRequest
    }));
}
export function getRoleDataScope(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: RoleScopeResponse;
    }>(`/api/v1/system/roles/${encodeURIComponent(id)}/data-scope`, {
        ...opts
    });
}
export function setRoleDataScope(id: string, roleScopeRequest: RoleScopeRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/roles/${encodeURIComponent(id)}/data-scope`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: roleScopeRequest
    }));
}
export function setRoleStatus(id: string, roleStatusRequest: RoleStatusRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/roles/${encodeURIComponent(id)}/status`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: roleStatusRequest
    }));
}
export function cancelRoleUsers(id: string, roleUsersRequest: RoleUsersRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/roles/${encodeURIComponent(id)}/users`, oazapfts.json({
        ...opts,
        method: "DELETE",
        body: roleUsersRequest
    }));
}
export function listRoleUsers(id: string, { assigned, page, pageSize, username, phone }: {
    assigned?: boolean;
    page?: number;
    pageSize?: number;
    username?: string;
    phone?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseUserResponse;
    }>(`/api/v1/system/roles/${encodeURIComponent(id)}/users${QS.query(QS.explode({
        assigned,
        page,
        pageSize,
        username,
        phone
    }))}`, {
        ...opts
    });
}
export function assignRoleUsers(id: string, roleUsersRequest: RoleUsersRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/roles/${encodeURIComponent(id)}/users`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: roleUsersRequest
    }));
}
export function deleteUsers(deleteUsersRequest: DeleteUsersRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/users", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteUsersRequest
    }));
}
export function listUsers({ page, pageSize, username, phone, status, departmentId, beginDate, endDate }: {
    page?: number;
    pageSize?: number;
    username?: string;
    phone?: string;
    status?: string;
    departmentId?: string;
    beginDate?: string;
    endDate?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseUserResponse;
    }>(`/api/v1/system/users${QS.query(QS.explode({
        page,
        pageSize,
        username,
        phone,
        status,
        departmentId,
        beginDate,
        endDate
    }))}`, {
        ...opts
    });
}
export function createUser(createUserRequest: CreateUserRequestWrite, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: UserResponse;
    }>("/api/v1/system/users", oazapfts.json({
        ...opts,
        method: "POST",
        body: createUserRequest
    }));
}
export function listUserDepartments(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DepartmentResponse[];
    }>("/api/v1/system/users/departments", {
        ...opts
    });
}
export function exportUsers({ username, phone, status, departmentId, beginDate, endDate }: {
    username?: string;
    phone?: string;
    status?: string;
    departmentId?: string;
    beginDate?: string;
    endDate?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/users/export${QS.query(QS.explode({
        username,
        phone,
        status,
        departmentId,
        beginDate,
        endDate
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function importUsers(body?: {
    file: Blob;
}, { updateExisting }: {
    updateExisting?: boolean;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: UserImportResponse;
    }>(`/api/v1/system/users/import${QS.query(QS.explode({
        updateExisting
    }))}`, oazapfts.multipart({
        ...opts,
        method: "POST",
        body
    }));
}
export function downloadUserImportTemplate(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>("/api/v1/system/users/import-template", {
        ...opts,
        method: "POST"
    });
}
export function getUserOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: UserOptionsResponseRead;
    }>("/api/v1/system/users/options", {
        ...opts
    });
}
export function getUser(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: UserEditorResponse;
    }>(`/api/v1/system/users/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateUser(id: string, userWriteRequest: UserWriteRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: UserResponse;
    }>(`/api/v1/system/users/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: userWriteRequest
    }));
}
export function resetUserPassword(id: string, resetUserPasswordRequest: ResetUserPasswordRequestWrite, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/users/${encodeURIComponent(id)}/password`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: resetUserPasswordRequest
    }));
}
export function getUserRoles(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: UserEditorResponse;
    }>(`/api/v1/system/users/${encodeURIComponent(id)}/roles`, {
        ...opts
    });
}
export function setUserRoles(id: string, userRolesRequest: UserRolesRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/users/${encodeURIComponent(id)}/roles`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: userRolesRequest
    }));
}
export function setUserStatus(id: string, userStatusRequest: UserStatusRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/users/${encodeURIComponent(id)}/status`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: userStatusRequest
    }));
}
