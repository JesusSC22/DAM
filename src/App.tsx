import { useLayoutEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AssetProvider } from './context/AssetContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingOverlay } from './components/LoadingOverlay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useAppStore } from './store/useAppStore';

// Lazy loading de páginas para mejorar el rendimiento inicial
// Manejar errores de carga de módulos dinámicos (cache, base path, etc.)
const lazyLoadWithRetry = (importFn: () => Promise<any>, retries = 2) => {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error: any) {
        // Si falla y hay reintentos disponibles, intentar recargar la página
        if (i < retries - 1 && error?.message?.includes('Failed to fetch dynamically imported module')) {
          console.warn(`Error cargando módulo dinámico, intento ${i + 1}/${retries}. Recargando página...`);
          // Esperar un poco antes de recargar
          await new Promise(resolve => setTimeout(resolve, 1000));
          window.location.reload();
          throw error; // Reload ya inició, esto no debería ejecutarse
        }
        throw error;
      }
    }
    throw new Error('No se pudo cargar el módulo después de varios intentos');
  });
};

const Home = lazyLoadWithRetry(() => import('./pages/Home').then(module => ({ default: module.Home })));
const AssetDetail = lazyLoadWithRetry(() => import('./pages/AssetDetail').then(module => ({ default: module.AssetDetail })));
const DatabaseManagement = lazyLoadWithRetry(() => import('./pages/DatabaseManagement').then(module => ({ default: module.DatabaseManagement })));

function App() {
  const { darkMode, isLoading, loadingMessage, isSyncing } = useAppStore();

  useLayoutEffect(() => {
    // Force sync DOM with state immediately before paint
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <ErrorBoundary>
      <AssetProvider>
        <LoadingOverlay 
          isVisible={isLoading || isSyncing} 
          message={isLoading ? loadingMessage : isSyncing ? 'Sincronizando con servidor...' : undefined}
        />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: darkMode ? '#1f2937' : '#fff',
              color: darkMode ? '#f3f4f6' : '#111827',
              borderRadius: '0.75rem',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <Router>
          <Suspense 
            fallback={
              <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <LoadingSpinner size={48} />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/asset/:id" element={<AssetDetail />} />
              <Route path="/database" element={<DatabaseManagement />} />
            </Routes>
          </Suspense>
        </Router>
      </AssetProvider>
    </ErrorBoundary>
  );
}

export default App;
