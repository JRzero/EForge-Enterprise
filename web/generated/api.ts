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
export type CommandStatistic = {
    calls: string;
    name: string;
};
export type RedisInformation = {
    aofEnabled?: string;
    connectedClients?: string;
    inputKbps?: string;
    maxMemory?: string;
    mode?: string;
    outputKbps?: string;
    port?: string;
    rdbLastSaveStatus?: string;
    uptimeDays?: string;
    usedMemory?: string;
    usedMemoryBytes?: string;
    userChildrenCpuSeconds?: string;
    version?: string;
};
export type CacheStatistics = {
    commands: CommandStatistic[];
    info: RedisInformation;
    keyCount: string;
};
export type ClearCacheKeyRequest = {
    key: string;
    name: string;
};
export type CacheName = {
    description: string;
    name: string;
};
export type CacheValue = {
    key: string;
    name: string;
    value: string;
};
export type ConsoleStatus = {
    enabled: boolean;
};
export type ConsoleEntry = {
    entryPath: string;
    expiresInSeconds: number;
};
export type DeleteLogsRequest = {
    ids: string[];
};
export type JobLogResponse = {
    createdAt?: string;
    endedAt?: string;
    group?: string;
    id: string;
    invokeTarget?: string;
    message?: string;
    name?: string;
    startedAt?: string;
    status?: string;
};
export type PageResponseJobLogResponse = {
    items: JobLogResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type JobLogDetail = {
    entry: JobLogResponse;
    exceptionInfo?: string;
};
export type JobResponse = {
    concurrent?: boolean;
    createdAt?: string;
    cronExpression?: string;
    group?: string;
    id: string;
    invokeTarget?: string;
    misfirePolicy?: string;
    name?: string;
    nextExecutionAt?: string;
    remark?: string;
    status?: string;
    updatedAt?: string;
};
export type PageResponseJobResponse = {
    items: JobResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type CronPreviewResponse = {
    times: string[];
    zone: string;
};
export type LoginLogResponse = {
    browser?: string;
    id: string;
    ip?: string;
    location?: string;
    loggedInAt?: string;
    message?: string;
    operatingSystem?: string;
    status?: string;
    username?: string;
};
export type PageResponseLoginLogResponse = {
    items: LoginLogResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type UnlockLoginRequest = {
    username: string;
};
export type OnlineSessionResponse = {
    browser?: string;
    departmentName?: string;
    id: string;
    ip?: string;
    location?: string;
    loggedInAt?: string;
    operatingSystem?: string;
    username: string;
};
export type PageResponseOnlineSessionResponse = {
    items: OnlineSessionResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type OperationLogResponse = {
    businessType?: number;
    duration?: number;
    id: string;
    ip?: string;
    location?: string;
    operatedAt?: string;
    operator?: string;
    status?: string;
    title: string;
};
export type PageResponseOperationLogResponse = {
    items: OperationLogResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type OperationLogDetail = {
    departmentName?: string;
    entry: OperationLogResponse;
    errorMessage?: string;
    method?: string;
    operatorType?: number;
    requestMethod?: string;
    requestParameters?: string;
    responseBody?: string;
    url?: string;
};
export type CpuMetrics = {
    coreCount?: number;
    idlePercent?: number;
    systemPercent?: number;
    userPercent?: number;
    waitPercent?: number;
};
export type DiskMetrics = {
    fileSystem?: string;
    freeSize?: string;
    mount?: string;
    totalSize?: string;
    "type"?: string;
    usagePercent?: number;
    usedSize?: string;
};
export type HostMetrics = {
    architecture?: string;
    ip?: string;
    name?: string;
    operatingSystem?: string;
    workingDirectory?: string;
};
export type JvmMetrics = {
    arguments?: string;
    freeMiB?: number;
    home?: string;
    maxMiB?: number;
    name?: string;
    startedAt?: string;
    totalMiB?: number;
    uptime?: string;
    usagePercent?: number;
    usedMiB?: number;
    version?: string;
};
export type MemoryMetrics = {
    freeGiB?: number;
    totalGiB?: number;
    usagePercent?: number;
    usedGiB?: number;
};
export type ServerMonitorResponse = {
    cpu: CpuMetrics;
    disks: DiskMetrics[];
    host: HostMetrics;
    jvm: JvmMetrics;
    memory: MemoryMetrics;
    sampledAt: string;
};
export type DeleteConfigurationsRequest = {
    ids: string[];
};
export type ConfigurationResponse = {
    builtin: boolean;
    createdAt?: string;
    id: string;
    key: string;
    name: string;
    remark?: string;
    value: string;
};
export type PageResponseConfigurationResponse = {
    items: ConfigurationResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type ConfigurationRequest = {
    builtin: boolean;
    key: string;
    name: string;
    remark?: string;
    value: string;
};
export type ConfigurationValueResponse = {
    value: string;
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
export type DeleteDictionariesRequest = {
    ids: string[];
};
export type DictionaryResponse = {
    code: string;
    createdAt?: string;
    id: string;
    name: string;
    remark?: string;
    status: string;
};
export type PageResponseDictionaryResponse = {
    items: DictionaryResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type DictionaryRequest = {
    code: string;
    name: string;
    remark?: string;
    status: string;
};
export type DictionaryValueOption = {
    cssClass?: string;
    defaultEntry: boolean;
    label: string;
    style: "DEFAULT" | "PRIMARY" | "SUCCESS" | "INFO" | "WARNING" | "DANGER";
    value: string;
};
export type DictionaryTypeOption = {
    code: string;
    id: string;
    name: string;
    status: string;
};
export type DeleteDictionaryEntriesRequest = {
    ids: string[];
};
export type DictionaryEntryResponse = {
    createdAt?: string;
    cssClass?: string;
    defaultEntry: boolean;
    dictionaryCode: string;
    dictionaryId: string;
    id: string;
    label: string;
    remark?: string;
    sort: number;
    status: string;
    style: "DEFAULT" | "PRIMARY" | "SUCCESS" | "INFO" | "WARNING" | "DANGER";
    value: string;
};
export type PageResponseDictionaryEntryResponse = {
    items: DictionaryEntryResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type EntryRequest = {
    cssClass?: string;
    defaultEntry: boolean;
    dictionaryId: string;
    label: string;
    remark?: string;
    sort: number;
    status: string;
    style: "DEFAULT" | "PRIMARY" | "SUCCESS" | "INFO" | "WARNING" | "DANGER";
    value: string;
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
export type NoticeIdsRequest = {
    ids: string[];
};
export type NoticeResponse = {
    content: string;
    createdAt?: string;
    createdBy?: string;
    id: string;
    remark?: string;
    status: string;
    title: string;
    "type": string;
};
export type PageResponseNoticeResponse = {
    items: NoticeResponse[];
    page: number;
    pageSize: number;
    total: number;
};
export type NoticeRequest = {
    content?: string;
    remark?: string;
    status: string;
    title: string;
    "type": string;
};
export type NoticeSummary = {
    createdAt?: string;
    createdBy?: string;
    id: string;
    read: boolean;
    title: string;
    "type": string;
};
export type NoticeFeed = {
    items: NoticeSummary[];
    unreadCount: number;
};
export type NoticeImageResponse = {
    imageUrl: string;
};
export type NoticeReader = {
    departmentName?: string;
    displayName?: string;
    phone?: string;
    readAt?: string;
    userId: string;
    username?: string;
};
export type PageResponseNoticeReader = {
    items: NoticeReader[];
    page: number;
    pageSize: number;
    total: number;
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
export type GeneratorCreationRequest = {
    template?: string;
};
export type GeneratorCreationRequestWrite = {
    sql: string;
    template?: string;
};
export type Imported = {
    actualName?: string;
    columnCount?: number;
    id?: string;
    requestedName?: string;
};
export type Outcome = {
    code?: string;
    name?: string;
    state?: "CREATED" | "FAILED" | "UNATTEMPTED" | "UNCONFIRMED";
};
export type Creation = {
    importState?: "IMPORTED" | "FAILED" | "UNATTEMPTED";
    imported?: Imported[];
    physical?: Outcome[];
};
export type CreationProblem = {
    code?: string;
    creation?: Creation;
    detail?: string | null;
    instance?: string | null;
    status?: number;
    title?: string | null;
    "type"?: string;
};
export type DatabaseTable = {
    comment?: string;
    createdAt?: string;
    name: string;
    updatedAt?: string;
};
export type PageResponseDatabaseTable = {
    items: DatabaseTable[];
    page: number;
    pageSize: number;
    total: number;
};
export type DownloadRequest = {
    tableIds: string[];
};
export type ImportRequest = {
    names: string[];
};
export type ImportedTable = {
    columnCount?: number;
    id: string;
    name: string;
};
export type ImportResponse = {
    tables: ImportedTable[];
};
export type DeleteGeneratorTablesRequest = {
    ids: string[];
};
export type TableSummary = {
    category?: string;
    className?: string;
    comment?: string;
    createdAt?: string;
    id: string;
    name?: string;
    updatedAt?: string;
    webType?: string;
};
export type PageResponseTableSummary = {
    items: TableSummary[];
    page: number;
    pageSize: number;
    total: number;
};
export type ColumnResponse = {
    autoIncrement?: boolean;
    comment?: string;
    controlType?: string;
    databaseType?: string;
    dictionaryType?: string;
    editable?: boolean;
    id: string;
    insertable?: boolean;
    javaField?: string;
    javaType?: string;
    listed?: boolean;
    name?: string;
    order?: number;
    primaryKey?: boolean;
    queryType?: string;
    queryable?: boolean;
    required?: boolean;
    tableId?: string;
};
export type Options = {
    generateDetail?: boolean;
    parentMenuId?: string;
    parentMenuName?: string;
    treeCode?: string;
    treeName?: string;
    treeParentCode?: string;
};
export type Configuration = {
    author?: string;
    businessName?: string;
    formColumns?: number;
    functionName?: string;
    moduleName?: string;
    options: Options;
    outputPath?: string;
    outputType?: string;
    packageName?: string;
    remark?: string;
    subTableForeignKey?: string;
    subTableName?: string;
};
export type TableChoice = {
    columns: ColumnResponse[];
    comment?: string;
    id: string;
    name?: string;
};
export type TableDetail = {
    columns: ColumnResponse[];
    configuration: Configuration;
    table: TableSummary;
    tables: TableChoice[];
};
export type GeneratorFieldUpdate = {
    comment?: string;
    controlType: "input" | "textarea" | "select" | "radio" | "checkbox" | "datetime" | "imageUpload" | "fileUpload" | "editor";
    dictionaryType?: string;
    editable: boolean;
    id: string;
    insertable: boolean;
    javaField: string;
    javaType: "Long" | "String" | "Integer" | "Double" | "BigDecimal" | "Date" | "Boolean";
    listed: boolean;
    order: number;
    queryType: "EQ" | "NE" | "GT" | "GTE" | "LT" | "LTE" | "LIKE" | "BETWEEN";
    queryable: boolean;
    required: boolean;
};
export type GeneratorConfigurationOptions = {
    generateDetail: boolean;
    parentMenuId?: string;
    treeCode?: string;
    treeName?: string;
    treeParentCode?: string;
};
export type GeneratorConfigurationUpdate = {
    author: string;
    businessName: string;
    category: "crud" | "tree" | "sub";
    className: string;
    columns: GeneratorFieldUpdate[];
    comment: string;
    formColumns: number;
    functionName: string;
    moduleName: string;
    name: string;
    options: GeneratorConfigurationOptions;
    outputPath?: string;
    outputType: string;
    packageName: string;
    remark?: string;
    subTableForeignKey?: string;
    subTableName?: string;
};
export type OutputFile = {
    content?: string;
    path?: string;
    template?: string;
};
export type PreviewResponse = {
    files?: OutputFile[];
    generationDate?: string;
    tableId?: string;
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
export function clearAllCache(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/cache", {
        ...opts,
        method: "DELETE"
    });
}
export function getCacheStatistics(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: CacheStatistics;
    }>("/api/v1/monitor/cache", {
        ...opts
    });
}
export function clearCacheKey(clearCacheKeyRequest: ClearCacheKeyRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/cache/keys", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: clearCacheKeyRequest
    }));
}
export function listCacheKeys(name: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: string[];
    }>(`/api/v1/monitor/cache/keys${QS.query(QS.explode({
        name
    }))}`, {
        ...opts
    });
}
export function listCacheNames(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: CacheName[];
    }>("/api/v1/monitor/cache/names", {
        ...opts
    });
}
export function clearCacheName(name: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/monitor/cache/names/${encodeURIComponent(name)}`, {
        ...opts,
        method: "DELETE"
    });
}
export function getCacheValue(name: string, key: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: CacheValue;
    }>(`/api/v1/monitor/cache/value${QS.query(QS.explode({
        name,
        key
    }))}`, {
        ...opts
    });
}
export function getApiDocsConsoleStatus(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConsoleStatus;
    }>("/api/v1/monitor/consoles/api-docs", {
        ...opts
    });
}
export function openApiDocsConsole(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConsoleEntry;
    }>("/api/v1/monitor/consoles/api-docs/session", {
        ...opts,
        method: "POST"
    });
}
export function getDruidConsoleStatus(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConsoleStatus;
    }>("/api/v1/monitor/consoles/druid", {
        ...opts
    });
}
export function openDruidConsole(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConsoleEntry;
    }>("/api/v1/monitor/consoles/druid/session", {
        ...opts,
        method: "POST"
    });
}
export function deleteJobLogs(deleteLogsRequest: DeleteLogsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/job-logs", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteLogsRequest
    }));
}
export function listJobLogs({ page, pageSize, name, group, invokeTarget, status, $from, to, direction, timeZone }: {
    page?: number;
    pageSize?: number;
    name?: string;
    group?: string;
    invokeTarget?: string;
    status?: number;
    $from?: string;
    to?: string;
    direction?: "asc" | "desc";
    timeZone?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseJobLogResponse;
    }>(`/api/v1/monitor/job-logs${QS.query(QS.explode({
        page,
        pageSize,
        name,
        group,
        invokeTarget,
        status,
        "from": $from,
        to,
        direction,
        timeZone
    }))}`, {
        ...opts
    });
}
export function clearJobLogs(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/job-logs/clear", {
        ...opts,
        method: "POST"
    });
}
export function exportJobLogs({ page, pageSize, name, group, invokeTarget, status, $from, to, direction, timeZone }: {
    page?: number;
    pageSize?: number;
    name?: string;
    group?: string;
    invokeTarget?: string;
    status?: number;
    $from?: string;
    to?: string;
    direction?: "asc" | "desc";
    timeZone?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/monitor/job-logs/export${QS.query(QS.explode({
        page,
        pageSize,
        name,
        group,
        invokeTarget,
        status,
        "from": $from,
        to,
        direction,
        timeZone
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getJobLog(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: JobLogDetail;
    }>(`/api/v1/monitor/job-logs/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function listJobs({ page, pageSize, name, group, invokeTarget, status, sort, direction }: {
    page?: number;
    pageSize?: number;
    name?: string;
    group?: string;
    invokeTarget?: string;
    status?: number;
    sort?: "id" | "name" | "createdAt";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseJobResponse;
    }>(`/api/v1/monitor/jobs${QS.query(QS.explode({
        page,
        pageSize,
        name,
        group,
        invokeTarget,
        status,
        sort,
        direction
    }))}`, {
        ...opts
    });
}
export function previewJobCron(expression: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: CronPreviewResponse;
    }>(`/api/v1/monitor/jobs/cron-preview${QS.query(QS.explode({
        expression
    }))}`, {
        ...opts
    });
}
export function exportJobs({ page, pageSize, name, group, invokeTarget, status, sort, direction }: {
    page?: number;
    pageSize?: number;
    name?: string;
    group?: string;
    invokeTarget?: string;
    status?: number;
    sort?: "id" | "name" | "createdAt";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/monitor/jobs/export${QS.query(QS.explode({
        page,
        pageSize,
        name,
        group,
        invokeTarget,
        status,
        sort,
        direction
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getJob(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: JobResponse;
    }>(`/api/v1/monitor/jobs/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function deleteLoginLogs(deleteLogsRequest: DeleteLogsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/login-logs", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteLogsRequest
    }));
}
export function listLoginLogs({ page, pageSize, ip, username, status, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    ip?: string;
    username?: string;
    status?: number;
    $from?: string;
    to?: string;
    sort?: "username" | "time";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseLoginLogResponse;
    }>(`/api/v1/monitor/login-logs${QS.query(QS.explode({
        page,
        pageSize,
        ip,
        username,
        status,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts
    });
}
export function clearLoginLogs(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/login-logs/clear", {
        ...opts,
        method: "POST"
    });
}
export function exportLoginLogs({ page, pageSize, ip, username, status, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    ip?: string;
    username?: string;
    status?: number;
    $from?: string;
    to?: string;
    sort?: "username" | "time";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/monitor/login-logs/export${QS.query(QS.explode({
        page,
        pageSize,
        ip,
        username,
        status,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function unlockLoginAccount(unlockLoginRequest: UnlockLoginRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/login-logs/unlock", oazapfts.json({
        ...opts,
        method: "POST",
        body: unlockLoginRequest
    }));
}
export function listOnlineSessions({ page, pageSize, ip, username }: {
    page?: number;
    pageSize?: number;
    ip?: string;
    username?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseOnlineSessionResponse;
    }>(`/api/v1/monitor/online-sessions${QS.query(QS.explode({
        page,
        pageSize,
        ip,
        username
    }))}`, {
        ...opts
    });
}
export function revokeOnlineSession(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/monitor/online-sessions/${encodeURIComponent(id)}`, {
        ...opts,
        method: "DELETE"
    });
}
export function deleteOperationLogs(deleteLogsRequest: DeleteLogsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/operation-logs", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteLogsRequest
    }));
}
export function listOperationLogs({ page, pageSize, ip, title, operator, businessType, status, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    ip?: string;
    title?: string;
    operator?: string;
    businessType?: number;
    status?: number;
    $from?: string;
    to?: string;
    sort?: "operator" | "time" | "duration";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseOperationLogResponse;
    }>(`/api/v1/monitor/operation-logs${QS.query(QS.explode({
        page,
        pageSize,
        ip,
        title,
        operator,
        businessType,
        status,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts
    });
}
export function clearOperationLogs(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/monitor/operation-logs/clear", {
        ...opts,
        method: "POST"
    });
}
export function exportOperationLogs({ page, pageSize, ip, title, operator, businessType, status, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    ip?: string;
    title?: string;
    operator?: string;
    businessType?: number;
    status?: number;
    $from?: string;
    to?: string;
    sort?: "operator" | "time" | "duration";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/monitor/operation-logs/export${QS.query(QS.explode({
        page,
        pageSize,
        ip,
        title,
        operator,
        businessType,
        status,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getOperationLog(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: OperationLogDetail;
    }>(`/api/v1/monitor/operation-logs/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function getServerMonitor(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ServerMonitorResponse;
    }>("/api/v1/monitor/server", {
        ...opts
    });
}
export function deleteConfigurations(deleteConfigurationsRequest: DeleteConfigurationsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/configurations", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteConfigurationsRequest
    }));
}
export function listConfigurations({ page, pageSize, name, key, builtin, $from, to }: {
    page?: number;
    pageSize?: number;
    name?: string;
    key?: string;
    builtin?: boolean;
    $from?: string;
    to?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseConfigurationResponse;
    }>(`/api/v1/system/configurations${QS.query(QS.explode({
        page,
        pageSize,
        name,
        key,
        builtin,
        "from": $from,
        to
    }))}`, {
        ...opts
    });
}
export function createConfiguration(configurationRequest: ConfigurationRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: ConfigurationResponse;
    }>("/api/v1/system/configurations", oazapfts.json({
        ...opts,
        method: "POST",
        body: configurationRequest
    }));
}
export function refreshConfigurationCache(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/configurations/cache/refresh", {
        ...opts,
        method: "POST"
    });
}
export function exportConfigurations({ name, key, builtin, $from, to }: {
    name?: string;
    key?: string;
    builtin?: boolean;
    $from?: string;
    to?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/configurations/export${QS.query(QS.explode({
        name,
        key,
        builtin,
        "from": $from,
        to
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getConfigurationValue(key: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConfigurationValueResponse;
    }>(`/api/v1/system/configurations/lookup${QS.query(QS.explode({
        key
    }))}`, {
        ...opts
    });
}
export function getConfiguration(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ConfigurationResponse;
    }>(`/api/v1/system/configurations/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateConfiguration(id: string, configurationRequest: ConfigurationRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/configurations/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: configurationRequest
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
export function deleteDictionaries(deleteDictionariesRequest: DeleteDictionariesRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/dictionaries", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteDictionariesRequest
    }));
}
export function listDictionaries({ page, pageSize, name, code, status, $from, to }: {
    page?: number;
    pageSize?: number;
    name?: string;
    code?: string;
    status?: string;
    $from?: string;
    to?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseDictionaryResponse;
    }>(`/api/v1/system/dictionaries${QS.query(QS.explode({
        page,
        pageSize,
        name,
        code,
        status,
        "from": $from,
        to
    }))}`, {
        ...opts
    });
}
export function createDictionary(dictionaryRequest: DictionaryRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: DictionaryResponse;
    }>("/api/v1/system/dictionaries", oazapfts.json({
        ...opts,
        method: "POST",
        body: dictionaryRequest
    }));
}
export function refreshDictionaryCache(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/dictionaries/cache/refresh", {
        ...opts,
        method: "POST"
    });
}
export function exportDictionaries({ name, code, status, $from, to }: {
    name?: string;
    code?: string;
    status?: string;
    $from?: string;
    to?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/dictionaries/export${QS.query(QS.explode({
        name,
        code,
        status,
        "from": $from,
        to
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getDictionaryValues(code: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DictionaryValueOption[];
    }>(`/api/v1/system/dictionaries/lookup/${encodeURIComponent(code)}`, {
        ...opts
    });
}
export function getDictionaryOptions(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DictionaryTypeOption[];
    }>("/api/v1/system/dictionaries/options", {
        ...opts
    });
}
export function getDictionary(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DictionaryResponse;
    }>(`/api/v1/system/dictionaries/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateDictionary(id: string, dictionaryRequest: DictionaryRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/dictionaries/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: dictionaryRequest
    }));
}
export function deleteDictionaryEntries(deleteDictionaryEntriesRequest: DeleteDictionaryEntriesRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/dictionary-entries", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteDictionaryEntriesRequest
    }));
}
export function listDictionaryEntries(dictionaryId: string, { page, pageSize, label, status }: {
    page?: number;
    pageSize?: number;
    label?: string;
    status?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseDictionaryEntryResponse;
    }>(`/api/v1/system/dictionary-entries${QS.query(QS.explode({
        page,
        pageSize,
        dictionaryId,
        label,
        status
    }))}`, {
        ...opts
    });
}
export function createDictionaryEntry(entryRequest: EntryRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: DictionaryEntryResponse;
    }>("/api/v1/system/dictionary-entries", oazapfts.json({
        ...opts,
        method: "POST",
        body: entryRequest
    }));
}
export function exportDictionaryEntries(dictionaryId: string, { label, status }: {
    label?: string;
    status?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>(`/api/v1/system/dictionary-entries/export${QS.query(QS.explode({
        dictionaryId,
        label,
        status
    }))}`, {
        ...opts,
        method: "POST"
    });
}
export function getDictionaryEntry(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: DictionaryEntryResponse;
    }>(`/api/v1/system/dictionary-entries/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateDictionaryEntry(id: string, entryRequest: EntryRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/dictionary-entries/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: entryRequest
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
export function getMenuOptions({ excludeId }: {
    excludeId?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: MenuResponse[];
    }>(`/api/v1/system/menus/options${QS.query(QS.explode({
        excludeId
    }))}`, {
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
export function deleteNotices(noticeIdsRequest: NoticeIdsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/notices", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: noticeIdsRequest
    }));
}
export function listNotices({ page, pageSize, title, author, $type }: {
    page?: number;
    pageSize?: number;
    title?: string;
    author?: string;
    $type?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseNoticeResponse;
    }>(`/api/v1/system/notices${QS.query(QS.explode({
        page,
        pageSize,
        title,
        author,
        "type": $type
    }))}`, {
        ...opts
    });
}
export function createNotice(noticeRequest: NoticeRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: NoticeResponse;
    }>("/api/v1/system/notices", oazapfts.json({
        ...opts,
        method: "POST",
        body: noticeRequest
    }));
}
export function getNoticeFeed(opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: NoticeFeed;
    }>("/api/v1/system/notices/feed", {
        ...opts
    });
}
export function uploadNoticeImage(body?: {
    file: Blob;
}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: NoticeImageResponse;
    }>("/api/v1/system/notices/images", oazapfts.multipart({
        ...opts,
        method: "POST",
        body
    }));
}
export function markNoticesRead(noticeIdsRequest: NoticeIdsRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/system/notices/read", oazapfts.json({
        ...opts,
        method: "POST",
        body: noticeIdsRequest
    }));
}
export function getNotice(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: NoticeResponse;
    }>(`/api/v1/system/notices/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateNotice(id: string, noticeRequest: NoticeRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/system/notices/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: noticeRequest
    }));
}
export function listNoticeReaders(id: string, { page, pageSize, search }: {
    page?: number;
    pageSize?: number;
    search?: string;
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseNoticeReader;
    }>(`/api/v1/system/notices/${encodeURIComponent(id)}/readers${QS.query(QS.explode({
        page,
        pageSize,
        search
    }))}`, {
        ...opts
    });
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
/**
 * Creates the prevalidated SQL batch and imports metadata. Physical DDL is not rolled back on partial failure; inspect the returned outcomes.
 */
export function createGeneratorTables(generatorCreationRequest: GeneratorCreationRequestWrite, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: Creation;
    } | {
        status: 400;
        data: CreationProblem;
    } | {
        status: 401;
        data: CreationProblem;
    } | {
        status: 403;
        data: CreationProblem;
    } | {
        status: 409;
        data: CreationProblem;
    } | {
        status: 500;
        data: CreationProblem;
    } | {
        status: 503;
        data: CreationProblem;
    }>("/api/v1/tool/generator/creations", oazapfts.json({
        ...opts,
        method: "POST",
        body: generatorCreationRequest
    }));
}
export function listGeneratorDatabaseTables({ page, pageSize, name, comment, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    name?: string;
    comment?: string;
    $from?: string;
    to?: string;
    sort?: "name" | "comment" | "createdAt" | "updatedAt";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseDatabaseTable;
    }>(`/api/v1/tool/generator/database-tables${QS.query(QS.explode({
        page,
        pageSize,
        name,
        comment,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts
    });
}
export function downloadGeneratorTables(downloadRequest: DownloadRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchBlob<{
        status: 200;
        data: Blob;
    }>("/api/v1/tool/generator/downloads", oazapfts.json({
        ...opts,
        method: "POST",
        body: downloadRequest
    }));
}
export function importGeneratorTables(importRequest: ImportRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 201;
        data: ImportResponse;
    }>("/api/v1/tool/generator/imports", oazapfts.json({
        ...opts,
        method: "POST",
        body: importRequest
    }));
}
export function deleteGeneratorTables(deleteGeneratorTablesRequest: DeleteGeneratorTablesRequest, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText("/api/v1/tool/generator/tables", oazapfts.json({
        ...opts,
        method: "DELETE",
        body: deleteGeneratorTablesRequest
    }));
}
export function listGeneratorTables({ page, pageSize, name, comment, $from, to, sort, direction }: {
    page?: number;
    pageSize?: number;
    name?: string;
    comment?: string;
    $from?: string;
    to?: string;
    sort?: "name" | "comment" | "createdAt" | "updatedAt";
    direction?: "asc" | "desc";
} = {}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PageResponseTableSummary;
    }>(`/api/v1/tool/generator/tables${QS.query(QS.explode({
        page,
        pageSize,
        name,
        comment,
        "from": $from,
        to,
        sort,
        direction
    }))}`, {
        ...opts
    });
}
export function getGeneratorTable(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: TableDetail;
    }>(`/api/v1/tool/generator/tables/${encodeURIComponent(id)}`, {
        ...opts
    });
}
export function updateGeneratorTable(id: string, generatorConfigurationUpdate: GeneratorConfigurationUpdate, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/tool/generator/tables/${encodeURIComponent(id)}`, oazapfts.json({
        ...opts,
        method: "PUT",
        body: generatorConfigurationUpdate
    }));
}
export function listGeneratorColumns(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: ColumnResponse[];
    }>(`/api/v1/tool/generator/tables/${encodeURIComponent(id)}/columns`, {
        ...opts
    });
}
export function previewGeneratorTable(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchJson<{
        status: 200;
        data: PreviewResponse;
    }>(`/api/v1/tool/generator/tables/${encodeURIComponent(id)}/preview`, {
        ...opts
    });
}
export function synchronizeGeneratorTable(id: string, opts?: Oazapfts.RequestOpts) {
    return oazapfts.fetchText(`/api/v1/tool/generator/tables/${encodeURIComponent(id)}/synchronize`, {
        ...opts,
        method: "POST"
    });
}
