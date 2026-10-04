import {defineAppRoutes, type AppRoute} from '@eforge/app';
import contracts from './route-contract.json';
import {DashboardPage} from '../features/dashboard/DashboardPage';
const dashboard = contracts.find(route => route.id === 'dashboard');
if (!dashboard) throw new Error('Missing dashboard route contract.');
export const routes: readonly AppRoute[] = defineAppRoutes([{
  id: dashboard.id, path: dashboard.path, title: '工作台',
  access: {permission: dashboard.permission}, component: DashboardPage
}]);
