import {Component, lazy, Suspense, type ComponentType, type ReactNode} from 'react';

interface Props<P extends object> {
  load: () => Promise<{default: ComponentType<P>}>;
  componentProps: P;
  fallback: ReactNode;
  errorFallback: (retry: () => void) => ReactNode;
}

/** An optional feature can fail without removing its surrounding shell or dialog. */
export class DeferredFeature<P extends object> extends Component<Props<P>, {failed: boolean}> {
  state = {failed: false};
  private feature = lazy(this.props.load);

  static getDerivedStateFromError() {
    return {failed: true};
  }

  private retry = () => {
    // React.lazy caches rejections. A user-requested retry needs a fresh wrapper.
    this.feature = lazy(this.props.load);
    this.setState({failed: false});
  };

  render() {
    if (this.state.failed) return this.props.errorFallback(this.retry);
    const Feature = this.feature;
    return <Suspense fallback={this.props.fallback}><Feature {...this.props.componentProps} /></Suspense>;
  }
}
