import {defineAppRoutes, type AppRoute} from '@eforge/app';
import contracts from './route-contract.json';
import internalContracts from './internal-route-contract.json';
import {DashboardPage} from '../features/dashboard/DashboardPage';
import {lazy} from 'react';
const PostsPage = lazy(() => import('../features/posts/PostsPage').then(module => ({default: module.PostsPage})));
const DepartmentsPage = lazy(() => import('../features/departments/DepartmentsPage').then(module => ({default: module.DepartmentsPage})));
const UsersPage = lazy(() => import('../features/users/UsersPage').then(module => ({default: module.UsersPage})));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage').then(module => ({default: module.ProfilePage})));
const RolesPage = lazy(() => import('../features/roles/RolesPage').then(module => ({default: module.RolesPage})));
const RoleUsersPage = lazy(() => import('../features/roles/RoleUsersPage').then(module => ({default: module.RoleUsersPage})));
const MenusPage = lazy(() => import('../features/menus/MenusPage').then(module => ({default: module.MenusPage})));
const DictionariesPage = lazy(() => import('../features/dictionaries/DictionariesPage').then(module => ({default: module.DictionariesPage})));
const ConfigurationsPage = lazy(() => import('../features/configurations/ConfigurationsPage').then(module => ({default: module.ConfigurationsPage})));
const NoticesPage = lazy(() => import('../features/notices/NoticesPage').then(module => ({default: module.NoticesPage})));
const OperationLogsPage = lazy(() => import('../features/logs/LogsPage').then(module => ({default: module.OperationLogsPage})));
const LoginLogsPage = lazy(() => import('../features/logs/LogsPage').then(module => ({default: module.LoginLogsPage})));
const OnlineSessionsPage = lazy(() => import('../features/online-sessions/OnlineSessionsPage').then(module => ({default: module.OnlineSessionsPage})));
const DictionaryEntriesPage = lazy(() => import('../features/dictionaries/DictionariesPage').then(module => ({default: module.DictionaryEntriesPage})));
const dashboard = contracts.find(route => route.id === 'dashboard');
if (!dashboard) throw new Error('Missing dashboard route contract.');
const posts = contracts.find(route => route.id === 'system-posts');
if (!posts) throw new Error('Missing posts route contract.');
const departments = contracts.find(route => route.id === 'system-departments');
if (!departments) throw new Error('Missing departments route contract.');
const users = contracts.find(route => route.id === 'system-users');
if (!users) throw new Error('Missing users route contract.');
const profile = internalContracts.find(route => route.id === 'account-profile');
if (!profile) throw new Error('Missing profile route contract.');
const rolesContract = contracts.find(route => route.id === 'system-roles');
if (!rolesContract) throw new Error('Missing roles route contract.');
const roleUsers = internalContracts.find(route => route.id === 'role-users');
if (!roleUsers) throw new Error('Missing role user route contract.');
const menus = contracts.find(route => route.id === 'system-menus');
if (!menus) throw new Error('Missing menus route contract.');
const dictionaries = contracts.find(route => route.id === 'system-dictionaries');
if (!dictionaries) throw new Error('Missing dictionary route contract.');
const dictionaryData = internalContracts.find(route => route.id === 'dictionary-data');
const configurations = contracts.find(route => route.id === 'system-configurations');
if (!configurations) throw new Error('Missing configuration route contract.');
const notices = contracts.find(route => route.id === 'system-notices');
if (!notices) throw new Error('Missing notices route contract.');
const operationLogs = contracts.find(route => route.id === 'monitor-operation-logs');
const loginLogs = contracts.find(route => route.id === 'monitor-login-logs');
if (!operationLogs || !loginLogs) throw new Error('Missing log route contracts.');
const onlineSessions = contracts.find(route => route.id === 'monitor-online-sessions');
if (!onlineSessions) throw new Error('Missing online session route contract.');
if (!dictionaryData) throw new Error('Missing dictionary data route contract.');
export const routes: readonly AppRoute[] = defineAppRoutes([{
  id: dashboard.id, path: dashboard.path, title: '工作台',
  access: {permission: dashboard.permission}, component: DashboardPage
}, {
  id: posts.id, path: posts.path, title: '岗位管理',
  access: {permission: posts.permission}, component: PostsPage
}, {
  id: departments.id, path: departments.path, title: '部门管理',
  access: {permission: departments.permission}, component: DepartmentsPage
}, {
  id: users.id, path: users.path, title: '用户管理',
  access: {permission: users.permission}, component: UsersPage
}, {
  id: rolesContract.id, path: rolesContract.path, title: '角色管理',
  access: {permission: rolesContract.permission}, component: RolesPage
}, {
  id: menus.id, path: menus.path, title: '菜单管理',
  access: {permission: menus.permission}, component: MenusPage
}, {
  id: dictionaries.id, path: dictionaries.path, title: '字典管理',
  access: {permission: dictionaries.permission}, component: DictionariesPage
}, {
  id: configurations.id, path: configurations.path, title: '参数配置',
  access: {permission: configurations.permission}, component: ConfigurationsPage
}, {
  id: notices.id, path: notices.path, title: '通知公告',
  access: {permission: notices.permission}, component: NoticesPage
}, {
  id: operationLogs.id, path: operationLogs.path, title: '操作日志',
  access: {permission: operationLogs.permission}, component: OperationLogsPage
}, {
  id: loginLogs.id, path: loginLogs.path, title: '登录日志',
  access: {permission: loginLogs.permission}, component: LoginLogsPage
}, {
  id: onlineSessions.id, path: onlineSessions.path, title: '在线用户',
  access: {permission: onlineSessions.permission}, component: OnlineSessionsPage
}, {
  id: profile.id, path: profile.path, title: '个人中心', component: ProfilePage
}, {
  id: roleUsers.id, path: roleUsers.path, title: '用户授权',
  access: {permission: roleUsers.permission}, component: RoleUsersPage
}, {
  id: dictionaryData.id, path: dictionaryData.path, title: '字典数据',
  access: {permission: dictionaryData.permission}, component: DictionaryEntriesPage
}]);
