import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-surface-900">
            Something went wrong
          </h2>
          <p className="text-sm text-surface-500 mt-1 max-w-sm">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                     bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }
}
