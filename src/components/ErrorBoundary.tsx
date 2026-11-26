import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { PANTRY_STORAGE_KEY } from '../hooks/usePantry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error captured in state for user-facing recovery UI
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      window.localStorage?.removeItem?.(PANTRY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center p-6"
        style={{
          backgroundColor: 'var(--bg-ground)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="flex w-full max-w-md overflow-hidden rounded-md border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-hazard-border)',
            boxShadow: 'var(--shadow-card)',
          }}
          role="alert"
        >
          <div aria-hidden="true" className="hazard-spine w-[3px] shrink-0" />
          <div className="flex-1 space-y-4 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: 'var(--accent-hazard)' }}
            />
            <div>
              <h1 className="text-base font-semibold">
                Something went wrong in the Compendium
              </h1>
              <p
                className="mt-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                The recipe compendium hit an unexpected rendering error.
                Reloading the page or resetting your saved Pantry usually
                resolves this.
              </p>
              {this.state.message && (
                <details className="mt-2 text-xs">
                  <summary
                    className="cursor-pointer font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Technical details
                  </summary>
                  <p
                    className="font-code mt-1 break-words"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {this.state.message}
                  </p>
                </details>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload Page
            </button>

            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-hazard-bg)',
                borderColor: 'var(--accent-hazard)',
                color: 'var(--accent-hazard)',
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset Saved Pantry &amp; Reload
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  }
}
