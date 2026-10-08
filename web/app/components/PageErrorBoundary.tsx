import {Component, type ReactNode} from 'react';
import {Button} from '@eforge/ui';

type Props = {children: ReactNode; title: string; onRetry: () => void};

/** Isolate route render/chunk failures without tearing down navigation or other cached pages. */
export class PageErrorBoundary extends Component<Props, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="state-page page-error-panel">
      <h2>{this.props.title}暂时无法显示</h2>
      <p>其他页面仍可使用。请重试当前页面；若资源加载失败，请重新加载应用。</p>
      <p>重新加载会清除尚未保存的页面内容。</p>
      <div className="state-actions">
        <Button label="重试当前页" onClick={this.props.onRetry} />
        <Button label="重新加载应用" variant="secondary" onClick={() => {
          if (window.confirm('重新加载将清除未保存的页面内容，是否继续？')) window.location.reload();
        }} />
      </div>
    </section>;
  }
}
