import {Component, type ReactNode} from 'react';
import {Button} from '@eforge/ui';

interface Props {
  title: string;
  onRetry: () => void;
  onReload: () => void;
  children: ReactNode;
}

/** The workspace shell stays usable when one page fails to load or render. */
export class PageErrorBoundary extends Component<Props, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="state-page" role="alert">
      <h1>{this.props.title}暂时无法打开</h1>
      <p>请重试此页面，也可以通过导航继续其他工作。</p>
      <p>如果重试后仍无法打开，请重新加载应用以获取最新页面。</p>
      <div className="state-actions">
        <Button label="重试此页面" onClick={this.props.onRetry} />
        <Button label="重新加载应用" variant="secondary" onClick={this.props.onReload} />
      </div>
    </section>;
  }
}
