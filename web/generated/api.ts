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
