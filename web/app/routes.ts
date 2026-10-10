import {defineAppRoutes, type AppRoute} from '@eforge/app';
import {appendGeneratedRoutes, generatedBusinessRoutes} from './generated-business-routes';
import contracts from './route-contract.json';
import internalContracts from './internal-route-contract.json';
import {DashboardPage} from '../features/dashboard/DashboardPage';
import {lazy} from 'react';
const WorkflowPackagesPage = lazy(() => import('../features/workflow/WorkflowPackagesPage').then(module => ({default: module.WorkflowPackagesPage})));
const workflowPackages = contracts.find(route => route.id === 'workflow-packages');
if (!workflowPackages) throw new Error('Missing workflow route contract.');
const WorkflowRequestsPage = lazy(() => import('../features/workflow/WorkflowLeavesPage').then(module => ({default: module.WorkflowRequestsPage})));
const WorkflowTasksPage = lazy(() => import('../features/workflow/WorkflowLeavesPage').then(module => ({default: module.WorkflowTasksPage})));
const workflowRequests = contracts.find(route => route.id === 'workflow-requests');
const workflowTasks = contracts.find(route => route.id === 'workflow-tasks');
if (!workflowRequests || !workflowTasks) throw new Error('Missing workflow approval route contracts.');
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
const ServerMonitorPage = lazy(() => import('../features/server-monitor/ServerMonitorPage').then(module => ({default: module.ServerMonitorPage})));
const CacheStatisticsPage = lazy(() => import('../features/cache-monitor/CacheStatisticsPage').then(module => ({default: module.CacheStatisticsPage})));
const CacheEntriesPage = lazy(() => import('../features/cache-monitor/CacheEntriesPage').then(module => ({default: module.CacheEntriesPage})));
const DruidConsolePage = lazy(() => import('../features/consoles/ConsolePage').then(module => ({default: module.DruidConsolePage})));
const ApiDocsConsolePage = lazy(() => import('../features/consoles/ConsolePage').then(module => ({default: module.ApiDocsConsolePage})));
const DictionaryEntriesPage = lazy(() => import('../features/dictionaries/DictionariesPage').then(module => ({default: module.DictionaryEntriesPage})));
const GeneratorPage = lazy(() => import('../features/generator/GeneratorPage').then(module => ({default: module.GeneratorPage})));
const JobsPage = lazy(() => import('../features/jobs/JobsPage').then(module => ({default: module.JobsPage})));
const JobLogsPage = lazy(() => import('../features/jobs/JobsPage').then(module => ({default: module.JobLogsPage})));
const jobs = contracts.find(route => route.id === 'monitor-jobs'), jobLogs = internalContracts.find(route => route.id === 'job-logs');
if (!jobs || !jobLogs) throw new Error('Missing task route contracts.');
const generator = contracts.find(route => route.id === 'tool-generator');
if (!generator) throw new Error('Missing generator route contract.');
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
const serverMonitor = contracts.find(route => route.id === 'monitor-server');
if (!serverMonitor) throw new Error('Missing server monitor route contract.');
const cacheStatistics = contracts.find(route => route.id === 'monitor-cache');
const cacheEntries = contracts.find(route => route.id === 'monitor-cache-entries');
if (!cacheStatistics || !cacheEntries) throw new Error('Missing cache monitor route contracts.');
const druid = contracts.find(route => route.id === 'monitor-druid'), apiDocs = contracts.find(route => route.id === 'tool-openapi');
if (!druid || !apiDocs) throw new Error('Missing diagnostic console route contracts.');
if (!dictionaryData) throw new Error('Missing dictionary data route contract.');
const baseRoutes: readonly AppRoute[] = defineAppRoutes([{
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
  id: serverMonitor.id, path: serverMonitor.path, title: '服务器监控',
  access: {permission: serverMonitor.permission}, component: ServerMonitorPage
}, {
  id: cacheStatistics.id, path: cacheStatistics.path, title: '缓存监控',
  access: {permission: cacheStatistics.permission}, component: CacheStatisticsPage
}, {
  id: cacheEntries.id, path: cacheEntries.path, title: '缓存列表',
  access: {permission: cacheEntries.permission}, component: CacheEntriesPage
}, {
  id: druid.id, path: druid.path, title: '数据监控', access: {permission: druid.permission}, component: DruidConsolePage
}, {
  id: apiDocs.id, path: apiDocs.path, title: '接口文档', access: {permission: apiDocs.permission}, component: ApiDocsConsolePage
}, {
  id: jobs.id, path: jobs.path, title: '定时任务', access: {permission: jobs.permission}, component: JobsPage
}, {
  id: generator.id, path: generator.path, title: '代码生成', access: {permission: generator.permission}, component: GeneratorPage
}, {
  id: workflowPackages.id, path: workflowPackages.path, title: '流程管理', access: {permission: workflowPackages.permission}, component: WorkflowPackagesPage
}, {
  id: workflowRequests.id, path: workflowRequests.path, title: '我发起的审批', access: {permission: workflowRequests.permission}, component: WorkflowRequestsPage
}, {
  id: workflowTasks.id, path: workflowTasks.path, title: '审批任务', access: {permission: workflowTasks.permission}, component: WorkflowTasksPage
}, {
  id: profile.id, path: profile.path, title: '个人中心', component: ProfilePage
}, {
  id: roleUsers.id, path: roleUsers.path, parentId: rolesContract.id, title: '用户授权',
  access: {permission: roleUsers.permission}, component: RoleUsersPage
}, {
  id: dictionaryData.id, path: dictionaryData.path, parentId: dictionaries.id, title: '字典数据',
  access: {permission: dictionaryData.permission}, component: DictionaryEntriesPage
}, {
  id: jobLogs.id, path: jobLogs.path, parentId: jobs.id, title: '调度日志', access: {permission: jobLogs.permission}, component: JobLogsPage
}]);

export const routes: readonly AppRoute[] = defineAppRoutes(appendGeneratedRoutes(baseRoutes, generatedBusinessRoutes));
