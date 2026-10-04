import {defineAppRoutes, type AppRoute} from '@eforge/app';
import contracts from './route-contract.json';
import {DashboardPage} from '../features/dashboard/DashboardPage';
import {lazy} from 'react';
const PostsPage = lazy(() => import('../features/posts/PostsPage').then(module => ({default: module.PostsPage})));
const DepartmentsPage = lazy(() => import('../features/departments/DepartmentsPage').then(module => ({default: module.DepartmentsPage})));
const dashboard = contracts.find(route => route.id === 'dashboard');
if (!dashboard) throw new Error('Missing dashboard route contract.');
const posts = contracts.find(route => route.id === 'system-posts');
if (!posts) throw new Error('Missing posts route contract.');
const departments = contracts.find(route => route.id === 'system-departments');
if (!departments) throw new Error('Missing departments route contract.');
export const routes: readonly AppRoute[] = defineAppRoutes([{
  id: dashboard.id, path: dashboard.path, title: '工作台',
  access: {permission: dashboard.permission}, component: DashboardPage
}, {
  id: posts.id, path: posts.path, title: '岗位管理',
  access: {permission: posts.permission}, component: PostsPage
}, {
  id: departments.id, path: departments.path, title: '部门管理',
  access: {permission: departments.permission}, component: DepartmentsPage
}]);
