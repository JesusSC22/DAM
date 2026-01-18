import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary global para capturar errores en cualquier parte de la aplicación
 * 
 * Este componente captura errores de JavaScript en cualquier parte del árbol de componentes,
 * los registra y muestra una UI de fallback en lugar del árbol de componentes que falló.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Actualiza el estado para que la próxima renderización muestre la UI de fallback
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Registra el error en el logger
    logger.default.error('Error capturado por ErrorBoundary:', error);
    logger.default.error('Error Info:', errorInfo);
    
    // También puedes enviar el error a un servicio de logging externo aquí
    // Ejemplo: Sentry.captureException(error, { extra: errorInfo });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Si hay un fallback personalizado, úsalo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback por defecto
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Algo salió mal
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Ha ocurrido un error inesperado en la aplicación
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  Detalles del error:
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-3">
                    <summary className="text-sm font-semibold text-red-800 dark:text-red-200 cursor-pointer">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCw size={18} />
                Intentar de nuevo
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCw size={18} />
                Recargar página
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
              >
                <Home size={18} />
                Ir al inicio
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Si el problema persiste, por favor contacta al soporte técnico o revisa la consola del navegador para más detalles.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

