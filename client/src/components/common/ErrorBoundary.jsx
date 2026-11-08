import React, { Component } from 'react';
import { Button } from '../ui/button.jsx';
import { AlertCircleIcon, RefreshIcon } from './Icons.jsx';
import { cn } from '../../lib/utils.js';

/**
 * ShopFinder — Application Error Boundary (Task 4.5)
 *
 * Catches unhandled JavaScript render and lifecycle errors in child component trees,
 * preventing blank white-screen application crashes and presenting an accessible recovery UI.
 *
 * Note: Per React architecture, Error Boundaries catch errors during rendering, in lifecycle methods,
 * and in constructors of the whole tree below them. They do not catch asynchronous errors,
 * event handlers, or server-side API failures.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (err) {
        console.warn('ErrorBoundary onError callback threw:', err);
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.warn('ErrorBoundary onReset callback threw:', err);
      }
    }
  };

  handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // 1. Support custom functional or element fallback
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 2. Default accessible, user-friendly recovery UI
      // Strictly hides raw stack traces, tokens, or internal code details from end users
      return (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            'min-h-[320px] flex items-center justify-center p-6 text-center',
            this.props.className
          )}
        >
          <div className="max-w-md w-full p-6 md:p-8 rounded-xl border border-destructive/20 bg-card text-card-foreground shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircleIcon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected error occurred while displaying this section. You can try recovering
                or reloading the page.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                <span>Try Again</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="w-full sm:w-auto"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

