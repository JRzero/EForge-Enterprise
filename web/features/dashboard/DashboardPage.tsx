import {DashboardPage as EForgeDashboard, PageHeader} from '@eforge/patterns';
import {useBootstrap} from '../../app/context';
export function DashboardPage() {
  const {user, roles, navigation} = useBootstrap();
  return <section className="dashboard">
    <PageHeader title={`你好，${user.displayName}`} description="查看当前工作空间，开始今天的工作。" eyebrow="工作台" />
    <div className="welcome-panel"><div><p className="eyebrow">准备就绪</p><h2>专注当下，有序前行。</h2>
      <p>你的账号已连接到企业工作空间。</p></div><span className="welcome-emblem" aria-hidden="true">E</span></div>
    <EForgeDashboard title="我的工作空间">
      <article className="summary-card"><p>当前账号</p><strong>{user.username}</strong><span>登录身份</span></article>
      <article className="summary-card"><p>账号角色</p><strong>{roles.length}</strong><span>{roles.length ? roles.join(' · ') : '暂无分配角色'}</span></article>
      <article className="summary-card"><p>工作入口</p><strong>{navigation.length}</strong><span>已为你开放的导航</span></article>
    </EForgeDashboard>
    <div className="workspace-note"><span className="status-dot" /><div><h3>你的工作空间已就绪</h3>
      <p>从左侧导航访问已开放的应用。新增入口由企业管理员分配。</p></div></div>
  </section>;
}
