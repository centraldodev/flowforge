import { Component, type ErrorInfo, type ReactNode } from 'react';

const STORAGE_KEY = 'flowforge-v1';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Captura erros de renderização e oferece recuperação sem perder o projeto salvo. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Flowforge] Erro não tratado:', error, info.componentStack);
  }

  private downloadBackup = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([saved], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'flowforge-backup.json',
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  private resetProject = () => {
    if (!window.confirm('Isso apaga o projeto salvo no navegador. Baixou o backup?')) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <h1>Algo deu errado</h1>
          <p>O editor encontrou um erro inesperado. Seu projeto continua salvo no navegador.</p>
          <pre>{this.state.error.message}</pre>
          <div className="error-boundary-actions">
            <button type="button" className="primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button type="button" className="secondary" onClick={this.downloadBackup}>
              Baixar backup (JSON)
            </button>
            <button type="button" className="secondary" onClick={this.resetProject}>
              Começar do zero
            </button>
          </div>
        </div>
      </div>
    );
  }
}
