import { Component } from 'react';

/**
 * Nothing in this app previously caught render-time errors — an uncaught
 * exception anywhere in a page's component tree unmounts the whole
 * subtree with zero visual feedback (React's default), which shows up to
 * users as an inexplicable blank page instead of a broken-but-diagnosable
 * one. Wraps DashboardLayout's routed content; resets when `resetKey`
 * (the pathname) changes so navigating away and back retries cleanly
 * rather than staying stuck on the fallback. Reset is done via
 * getDerivedStateFromProps (compares against the last-seen key stashed in
 * state) rather than componentDidUpdate, so it's a single render pass
 * instead of a setState-triggered second one.
 */
export class ErrorBoundary extends Component {
  state = { error: null, lastResetKey: undefined };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
          <p className="text-body-lg font-semibold text-ink">Something went wrong loading this page.</p>
          <p className="text-body text-ink-secondary max-w-sm">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
