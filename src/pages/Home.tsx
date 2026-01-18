import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sidebar } from '../components/Sidebar';
import { GalleryView } from '../components/GalleryView';
import { UploadModal } from '../components/UploadModal';
import { SettingsModal } from '../components/SettingsModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAssets } from '../context/AssetContext';
import { useAppStore } from '../store/useAppStore';
import { categories } from '../data/assets';
import { Box, Search, Settings, Upload, Wifi, WifiOff, Info } from 'lucide-react';
import { Asset } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { isDemoMode } from '../config/constants';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { assets, addAsset, deleteAsset, renameAsset, updateAssetFile, updateCategory } = useAssets();
  const [deleteConfirm, setDeleteConfirm] = useState<{ asset: Asset | null }>({ asset: null });
  
  const { 
    selectedCategory, 
    searchQuery, 
    setSearchQuery, 
    isUploadModalOpen, 
    setUploadModalOpen,
    isSettingsModalOpen,
    setSettingsModalOpen,
    selectedTags,
    filterPolygonsRange,
    filterDateRange,
    isSyncing
  } = useAppStore();

  // Debounce de la búsqueda para mejorar el rendimiento
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Lógica de filtrado
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // 1. Category
      // Si el asset no tiene categoryId o es 'all', asignarle 'prop' como default para filtrado
      const assetCategoryId = asset.categoryId && asset.categoryId !== 'all' ? asset.categoryId : 'prop';
      const matchesCategory = selectedCategory === 'all' || assetCategoryId === selectedCategory;
      
      // 2. Search (usando el valor debounced)
      const matchesSearch = asset.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      // 3. Tags (AND logic: asset must have all selected tags)
      const matchesTags = selectedTags.length === 0 || (asset.tags && selectedTags.every(tag => asset.tags!.includes(tag)));

      // 4. Polygons
      const polyCount = asset.metadata.polygons;
      const matchesPolygons = !filterPolygonsRange || (polyCount >= filterPolygonsRange[0] && polyCount <= filterPolygonsRange[1]);

      // 5. Date
      let matchesDate = true;
      if (filterDateRange[0] || filterDateRange[1]) {
        const assetDate = new Date(asset.metadata.createdDate);
        if (filterDateRange[0] && assetDate < filterDateRange[0]) matchesDate = false;
        if (filterDateRange[1] && assetDate > filterDateRange[1]) matchesDate = false;
      }

      return matchesCategory && matchesSearch && matchesTags && matchesPolygons && matchesDate;
    });
  }, [assets, selectedCategory, debouncedSearchQuery, selectedTags, filterPolygonsRange, filterDateRange]);

  const handleUpload = async (newAsset: Asset, files: { glb: File, thumbnail: File | null, unity: File | null, zip: File | null }) => {
    await addAsset(newAsset, files);
    setUploadModalOpen(false);
  };

  const handleDelete = async (asset: Asset) => {
    setDeleteConfirm({ asset });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.asset) {
      await deleteAsset(deleteConfirm.asset);
      setDeleteConfirm({ asset: null });
    }
  };

  // Atajos de teclado
  useKeyboardNavigation({
    onCtrlK: () => {
      // Enfocar el campo de búsqueda cuando se presiona Ctrl+K
      const searchInput = document.querySelector('input[type="text"][aria-label="Buscar en la biblioteca"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
    onEscape: () => {
      // Cerrar modales con Escape
      if (isUploadModalOpen) {
        setUploadModalOpen(false);
      }
      if (isSettingsModalOpen) {
        setSettingsModalOpen(false);
      }
      if (deleteConfirm.asset) {
        setDeleteConfirm({ asset: null });
      }
    },
  });

  const demoMode = isDemoMode();

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <Info size={16} />
          <span>
            <strong>Modo Demo:</strong> Funcionalidad limitada. Solo visualización de modelos existentes. Para funcionalidad completa, ejecuta el servidor localmente.
          </span>
        </div>
      )}
      
      {isUploadModalOpen && (
        <UploadModal 
          categories={categories} 
          onClose={() => setUploadModalOpen(false)} 
          onUpload={handleUpload} 
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal 
          onClose={() => setSettingsModalOpen(false)} 
        />
      )}

      {/* HEADER */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between shrink-0 z-30 relative transition-colors duration-200">
        <div className="flex items-center gap-2 w-64">
           <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 dark:shadow-blue-900/20 shadow-lg">
             <Box size={22} strokeWidth={2.5} />
           </div>
           <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">DAM</span>
        </div>

        <div className="flex-1 max-w-2xl px-4">
          <div className="relative group">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
             <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en la biblioteca..." 
              className="w-full bg-gray-100/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all placeholder-gray-400 dark:placeholder-gray-500"
              aria-label="Buscar en la biblioteca"
              role="searchbox"
             />
          </div>
        </div>

        <div className="flex items-center justify-end w-64 gap-2">
           {isSyncing && (
             <div className="flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 text-sm">
               <LoadingSpinner size={16} />
               <span className="hidden sm:inline">Sincronizando...</span>
             </div>
           )}
           <button 
             onClick={() => {
               if (demoMode) {
                 toast.error('Modo Demo: No se pueden subir archivos. Ejecuta el servidor localmente para funcionalidad completa.');
                 return;
               }
               setUploadModalOpen(true);
             }}
             disabled={demoMode}
             className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${
               demoMode 
                 ? 'bg-gray-400 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' 
                 : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-blue-900/20'
             }`}
             title={demoMode ? 'No disponible en modo demo' : 'Subir nuevo modelo'}
           >
              <Upload size={18} />
              <span>Subir Modelo</span>
           </button>
           <button 
             onClick={() => setSettingsModalOpen(true)}
             className="flex items-center gap-2 px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium"
           >
              <Settings size={18} />
           </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        <Sidebar />

        <div className="flex-1 relative bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden transition-colors duration-200">
           <GalleryView 
             assets={filteredAssets} 
             onSelect={(asset) => navigate(`/asset/${asset.id}`)}
             onDelete={handleDelete}
             onRename={renameAsset}
             onUpdateFile={updateAssetFile}
             onUpdateCategory={updateCategory}
           />
        </div>
      </div>

      {deleteConfirm.asset && (
        <ConfirmDialog
          isOpen={!!deleteConfirm.asset}
          title="Eliminar Modelo"
          message={`¿Estás seguro de que quieres eliminar "${deleteConfirm.asset.name}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm({ asset: null })}
          variant="danger"
        />
      )}
    </div>
  );
};
