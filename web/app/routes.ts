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
  id: profile.id, path: profile.path, title: '个人中心', component: ProfilePage
}, {
  id: roleUsers.id, path: roleUsers.path, title: '用户授权',
  access: {permission: roleUsers.permission}, component: RoleUsersPage
}]);
