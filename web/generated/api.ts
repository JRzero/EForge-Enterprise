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
export type DeleteUsersRequest = {
    ids: string[];
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
