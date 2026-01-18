import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAssets } from '../context/AssetContext';
import { useAppStore } from '../store/useAppStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { categories } from '../data/assets';
import { Asset } from '../types';
import { Box, ArrowLeft, Trash2, CheckSquare, Square, Database } from 'lucide-react';

export const DatabaseManagement: React.FC = () => {
  const navigate = useNavigate();
  const { assets, deleteAssets } = useAssets();
  const { 
    darkMode, 
    selectedCategory, 
    searchQuery: gallerySearchQuery,
    selectedTags,
    filterPolygonsRange,
    filterDateRange,
    resetFilters
  } = useAppStore();
  
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ assets: Asset[] | null }>({ assets: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Simular EXACTAMENTE los mismos filtros que en Home para ver qué se está filtrando
  const filteredAssetsInGallery = useMemo(() => {
    return assets.filter(asset => {
      // 1. Category (EXACTO a Home.tsx línea 38)
      const matchesCategory = selectedCategory === 'all' || asset.categoryId === selectedCategory;
      
      // 2. Search (EXACTO a Home.tsx línea 41)
      const matchesSearch = asset.name.toLowerCase().includes(gallerySearchQuery.toLowerCase());
      
      // 3. Tags (EXACTO a Home.tsx línea 44 - AND logic: asset must have all selected tags)
      const matchesTags = selectedTags.length === 0 || (asset.tags && selectedTags.every(tag => asset.tags!.includes(tag)));

      // 4. Polygons (EXACTO a Home.tsx líneas 47-48)
      const polyCount = asset.metadata.polygons;
      const matchesPolygons = !filterPolygonsRange || (polyCount >= filterPolygonsRange[0] && polyCount <= filterPolygonsRange[1]);

      // 5. Date (EXACTO a Home.tsx líneas 51-56)
      let matchesDate = true;
      if (filterDateRange[0] || filterDateRange[1]) {
        const assetDate = new Date(asset.metadata.createdDate);
        if (filterDateRange[0] && assetDate < filterDateRange[0]) matchesDate = false;
        if (filterDateRange[1] && assetDate > filterDateRange[1]) matchesDate = false;
      }

      return matchesCategory && matchesSearch && matchesTags && matchesPolygons && matchesDate;
    });
  }, [assets, selectedCategory, gallerySearchQuery, selectedTags, filterPolygonsRange, filterDateRange]);

  // Filtrar y ordenar assets
  const filteredAndSortedAssets = useMemo(() => {
    let filtered = assets.filter(asset => 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.metadata.createdDate).getTime() - new Date(b.metadata.createdDate).getTime();
          break;
        case 'category':
          const catA = categories.find(c => c.id === a.categoryId)?.name || '';
          const catB = categories.find(c => c.id === b.categoryId)?.name || '';
          comparison = catA.localeCompare(catB);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [assets, searchQuery, sortBy, sortOrder]);

  // Toggle selección individual
  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  // Seleccionar/deseleccionar todos
  const toggleSelectAll = () => {
    if (selectedAssets.size === filteredAndSortedAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAndSortedAssets.map(a => a.id)));
    }
  };

  // Obtener assets seleccionados
  const getSelectedAssets = (): Asset[] => {
    return filteredAndSortedAssets.filter(a => selectedAssets.has(a.id));
  };

  // Manejar eliminación en lote
  const handleBulkDelete = () => {
    const toDelete = getSelectedAssets();
    if (toDelete.length > 0) {
      setDeleteConfirm({ assets: toDelete });
    }
  };

  const confirmBulkDelete = async () => {
    if (deleteConfirm.assets) {
      await deleteAssets(deleteConfirm.assets);
      setSelectedAssets(new Set());
      setDeleteConfirm({ assets: null });
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const selectedCount = selectedAssets.size;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* HEADER */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between shrink-0 z-30 relative transition-colors duration-200">
        <div className="flex items-center gap-4">
          <Link 
            to="/"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-purple-200 dark:shadow-purple-900/20 shadow-lg">
              <Database size={22} strokeWidth={2.5} />
            </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">Gestión de Base de Datos</span>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{assets.length} modelo(s) en total</p>
              {assets.length !== filteredAssetsInGallery.length && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {filteredAssetsInGallery.length} visible(s) en galería (filtros activos)
                  </p>
                </>
              )}
            </div>
          </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Buscador */}
          <div className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar modelos..." 
              className="w-64 bg-gray-100/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2 px-4 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 transition-all placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Botón eliminar seleccionados */}
          {selectedCount > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm shadow-red-200 dark:shadow-red-900/20"
            >
              <Trash2 size={18} />
              <span>Eliminar {selectedCount} seleccionado(s)</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Toolbar de ordenamiento */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {selectedAssets.size === filteredAndSortedAssets.length && filteredAndSortedAssets.length > 0 ? (
                  <CheckSquare size={18} />
                ) : (
                  <Square size={18} />
                )}
                <span>Seleccionar todo</span>
              </button>
              {selectedCount > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCount} de {filteredAndSortedAssets.length} seleccionado(s)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'category')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="name">Nombre</option>
                <option value="date">Fecha</option>
                <option value="category">Categoría</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          
          {/* Indicador de filtros activos en galería */}
          {assets.length !== filteredAssetsInGallery.length && (
            <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                ⚠️ <strong>Filtros activos en galería:</strong> {filteredAssetsInGallery.length} visible(s) de {assets.length} total
              </span>
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                {selectedCategory !== 'all' && (
                  <span>Categoría: {getCategoryName(selectedCategory)}</span>
                )}
                {gallerySearchQuery && (
                  <span>Búsqueda: "{gallerySearchQuery}"</span>
                )}
                {selectedTags.length > 0 && (
                  <span>Tags: {selectedTags.join(', ')}</span>
                )}
                {filterPolygonsRange && (
                  <span>Polígonos: {filterPolygonsRange[0]}-{filterPolygonsRange[1]}</span>
                )}
                {(filterDateRange[0] || filterDateRange[1]) && (
                  <span>Fecha: {filterDateRange[0]?.toLocaleDateString()} - {filterDateRange[1]?.toLocaleDateString()}</span>
                )}
              </div>
              {(selectedCategory !== 'all' || gallerySearchQuery || selectedTags.length > 0 || filterPolygonsRange || (filterDateRange[0] || filterDateRange[1])) && (
                <button
                  onClick={resetFilters}
                  className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabla de modelos */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-4">
            {filteredAndSortedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <Box size={64} className="text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No se encontraron modelos
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'Intenta con otra búsqueda' : 'No hay modelos en la base de datos'}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          checked={selectedAssets.size === filteredAndSortedAssets.length && filteredAndSortedAssets.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Modelo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Polígonos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Tamaño
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAndSortedAssets.map((asset) => (
                      <tr
                        key={asset.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                          selectedAssets.has(asset.id) ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                        }`}
                        onClick={() => navigate(`/asset/${asset.id}`)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedAssets.has(asset.id)}
                            onChange={() => toggleAssetSelection(asset.id)}
                            className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {asset.thumbnail ? (
                              <img
                                src={asset.thumbnail}
                                alt={asset.name}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="%23e5e7eb" width="48" height="48"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="24">📦</text></svg>';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <Box size={20} className="text-gray-400 dark:text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {asset.name}
                              </div>
                              {asset.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                  {asset.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {getCategoryName(asset.categoryId)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {asset.metadata.polygons.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {asset.fileSize || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(asset.metadata.createdDate)}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {asset.id.substring(0, 8)}...
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmación de eliminación en lote */}
      {deleteConfirm.assets && (
        <ConfirmDialog
          isOpen={!!deleteConfirm.assets}
          title="Eliminar Modelos Seleccionados"
          message={`¿Estás seguro de que quieres eliminar ${deleteConfirm.assets.length} modelo(s)? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={confirmBulkDelete}
          onCancel={() => setDeleteConfirm({ assets: null })}
          variant="danger"
        />
      )}
    </div>
  );
};

