import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('ErrorBoundary caught a component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full bg-slate-900 border border-white/10 rounded-3xl p-6 text-white text-center space-y-3">
          <AlertCircle className="mx-auto text-gold" size={28} />
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">
            {this.props.fallbackTitle || "Module temporairement indisponible"}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Une interruption est survenue lors de l'affichage de ce composant.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw size={13} /> Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
